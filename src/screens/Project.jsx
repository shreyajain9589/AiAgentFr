import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js'
import { getWebContainer } from '../config/webContainer'

function SyntaxHighlightedCode(props) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current && props.className?.includes("lang-") && window.hljs) {
      window.hljs.highlightElement(ref.current)
      ref.current.removeAttribute("data-highlighted")
    }
  }, [props.className, props.children])

  return <code {...props} ref={ref} />
}

const Project = () => {
  const location = useLocation()
  const { user } = useContext(UserContext)

  const [project, setProject] = useState(location.state.project)
  const [messages, setMessages] = useState(location.state.project.messages || [])
  const [message, setMessage] = useState("")
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(new Set())
  const messageBox = useRef(null)

  // Code editor states
  const [fileTree, setFileTree] = useState({})
  const [currentFile, setCurrentFile] = useState(null)
  const [openFiles, setOpenFiles] = useState([])

  const [webContainer, setWebContainer] = useState(null)
  const [iframeUrl, setIframeUrl] = useState(null)
  const [runProcess, setRunProcess] = useState(null)

  // Scroll chat to bottom
  useEffect(() => {
    if (messageBox.current) {
      messageBox.current.scrollTop = messageBox.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    initializeSocket(project._id)

    if (!import.meta.env.PROD) {
      getWebContainer().then(container => {
        setWebContainer(container)
        console.log("WebContainer ready")
      })
    }

    // Receive realtime messages
    receiveMessage("project-message", (data) => {
      console.log("SOCKET MSG:", data)

      setMessages(prev => {
        if (data._id && prev.some(m => m._id === data._id)) return prev
        return [...prev, data]
      })
    })

    // load fileTree (backend)
    axios.get(`/projects/get-project/${project._id}`).then(res => {
      setProject(res.data.project)
      setFileTree(res.data.project.fileTree || {})
    })

    // load chat history
    axios.get(`/projects/messages/${project._id}`).then(res => {
      setMessages(res.data.messages || [])
    })

    // load all users for collaborator panel
    axios.get("/users/all").then(res => {
      setUsers(res.data.users)
    })

  }, [])

  // Save code changes
  function saveFileTree(ft) {
    axios.put("/projects/update-file-tree", {
      projectId: project._id,
      fileTree: ft
    })
  }

  // Add collaborators
  function addCollaborators() {
    axios.put("/projects/add-user", {
      projectId: project._id,
      users: Array.from(selectedUserId)
    })
  }

  // Write AI Message
  function WriteAiMessage(messageStr) {
    let obj = JSON.parse(messageStr)

    return (
      <div className="overflow-auto bg-slate-950 text-white rounded-sm p-2">
        <Markdown
          children={obj.text}
          options={{
            overrides: {
              code: SyntaxHighlightedCode
            }
          }}
        />
      </div>
    )
  }

  // SEND MESSAGE — DB save + socket emit
  const send = async () => {
    const text = message.trim()
    if (!text) return

    const payload = {
      projectId: project._id,
      sender: { _id: user._id, email: user.email },
      message: text
    }

    try {
      // 1️⃣ Save to DB
      const res = await axios.post("/projects/message", payload)
      const savedMessage = res.data.message

      // 2️⃣ Add locally
      setMessages(prev => [...prev, savedMessage])

      // 3️⃣ Emit socket with same structure
      sendMessage("project-message", {
        _id: savedMessage._id,
        sender: savedMessage.sender,
        message: savedMessage.message,
        createdAt: savedMessage.createdAt
      })

      setMessage("")
    } catch (err) {
      console.error("Send failed:", err)
    }
  }

  return (
    <main className="h-screen w-screen flex">

      {/* LEFT CHAT PANEL */}
      <section className="left bg-slate-300 min-w-96 flex flex-col">
        <header className="p-3 bg-slate-100 flex justify-between">
          <p className="font-semibold">Project Chat</p>
        </header>

        {/* Chat messages */}
        <div ref={messageBox} className="flex-grow overflow-auto p-2">
          {messages.map((msg, index) => (
            <div key={msg._id || index}
              className={`${msg.sender._id === user._id ? "ml-auto" : ""} 
              bg-slate-50 p-2 rounded mb-1 max-w-80`}>

              <small className="opacity-60">{msg.sender.email}</small>

              {msg.sender._id === "ai" ?
                WriteAiMessage(msg.message)
                : <p>{msg.message}</p>}
            </div>
          ))}
        </div>

        {/* Chat input */}
        <div className="p-2 flex bg-white">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-grow p-2 outline-none"
            placeholder="Type message"
          />
          <button onClick={send} className="px-4 bg-black text-white">
            Send
          </button>
        </div>
      </section>

      {/* RIGHT CODE EDITOR PANEL */}
      <section className="flex-grow flex bg-red-50">

        {/* FILE TREE */}
        <div className="bg-slate-200 min-w-52 p-2">
          {Object.keys(fileTree).map((file, idx) => (
            <button key={idx}
              className="w-full text-left p-2 bg-slate-300 mb-1"
              onClick={() => {
                setCurrentFile(file)
                setOpenFiles(prev => [...new Set([...prev, file])])
              }}>
              {file}
            </button>
          ))}
        </div>

        {/* EDITOR */}
        <div className="flex-grow flex flex-col">
          <div className="flex bg-slate-200 p-2">
            {openFiles.map((file, idx) => (
              <button key={idx}
                onClick={() => setCurrentFile(file)}
                className={`px-4 py-1 ${currentFile === file ? "bg-slate-400" : "bg-slate-300"}`}>
                {file}
              </button>
            ))}
          </div>

          {/* Code Editor */}
          {fileTree[currentFile] &&
            <pre className="flex-grow overflow-auto bg-white p-2">
              <code
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  const updated = e.target.innerText
                  const ft = {
                    ...fileTree,
                    [currentFile]: { file: { contents: updated } }
                  }
                  setFileTree(ft)
                  saveFileTree(ft)
                }}
                dangerouslySetInnerHTML={{
                  __html: hljs.highlight(
                    "javascript",
                    fileTree[currentFile].file.contents
                  ).value
                }}
              />
            </pre>
          }
        </div>

      </section>
    </main>
  )
}

export default Project
