import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webContainer'

function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)
            ref.current.removeAttribute('data-highlighted')
        }
    }, [props.className, props.children])

    return <code {...props} ref={ref} />
}

const Project = () => {
    const location = useLocation()
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState(new Set())
    const [project, setProject] = useState(location.state.project)
    const [message, setMessage] = useState('')
    const { user } = useContext(UserContext)
    const messageBox = useRef(null)

    const [users, setUsers] = useState([])
    const [messages, setMessages] = useState(location.state.project.messages || [])
    const [fileTree, setFileTree] = useState({})
    const [currentFile, setCurrentFile] = useState(null)
    const [openFiles, setOpenFiles] = useState([])

    const [webContainer, setWebContainer] = useState(null)
    const [iframeUrl, setIframeUrl] = useState(null)
    const [runProcess, setRunProcess] = useState(null)

    const handleUserClick = (id) => {
        setSelectedUserId(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) newSet.delete(id)
            else newSet.add(id)
            return newSet
        })
    }

    // Auto-scroll to bottom
    useEffect(() => {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight
        }
    }, [messages])

    // Add collaborator
    function addCollaborators() {
        axios.put("/projects/add-user", {
            projectId: project._id.toString(),
            users: Array.from(selectedUserId)
        }).then(res => {
            setProject(res.data.project)
            setIsModalOpen(false)
        }).catch(err => console.log(err))
    }

    // Send message
    const send = async () => {
        const text = message.trim()
        if (!text) return

        const payload = {
            projectId: project._id,
            sender: { _id: user._id, email: user.email },
            message: text
        }

        try {
            // Save to DB
            const res = await axios.post("/projects/message", payload)
            const savedMessage = res.data.message

            setMessages(prev => [...prev, savedMessage])

            // Send socket event
            sendMessage("project-message", savedMessage)
            setMessage("")
        } catch (err) {
            console.log("Message error:", err)
        }
    }

    function WriteAiMessage(messageStr) {
        const obj = JSON.parse(messageStr)
        return (
            <div className="overflow-auto bg-slate-950 text-white rounded-sm p-2">
                <Markdown
                    children={obj.text}
                    options={{ overrides: { code: SyntaxHighlightedCode } }}
                />
            </div>
        )
    }

    useEffect(() => {
        initializeSocket(project._id)

        // WebContainer only works in DEV
        if (!import.meta.env.PROD) {
            getWebContainer().then(container => {
                setWebContainer(container)
            })
        }

        receiveMessage("project-message", (data) => {
            setMessages(prev => [...prev, data])

            if (!import.meta.env.PROD && data.sender._id === "ai" && data.fileTree) {
                try { webContainer?.mount(data.fileTree) } catch { }
            }
        })

        axios.get(`/projects/get-project/${project._id}`).then(res => {
            setProject(res.data.project)
            setFileTree(res.data.project.fileTree || {})
        })

        axios.get(`/projects/messages/${project._id}`).then(res => {
            setMessages(res.data.messages)
        })

        axios.get("/users/all").then(res => setUsers(res.data.users))
    }, [])

    function saveFileTree(ft) {
        axios.put("/projects/update-file-tree", {
            projectId: project._id,
            fileTree: ft
        })
    }

    return (
        <main className='h-screen w-screen flex'>
            
            {/* LEFT CHAT PANEL */}
            <section className="left relative flex flex-col h-screen min-w-96 bg-slate-300">
                <header className="flex justify-between items-center p-2 px-4 w-full bg-slate-100 absolute z-10 top-0">
                    <button className="flex gap-2" onClick={() => setIsModalOpen(true)}>
                        <i className="ri-add-fill mr-1"></i> Add collaborator
                    </button>

                    <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className="p-2">
                        <i className="ri-group-fill"></i>
                    </button>
                </header>

                <div className="conversation-area pt-14 pb-10 flex-grow flex flex-col relative">
                    <div ref={messageBox} className="message-box p-1 flex-grow flex flex-col gap-1 overflow-auto">
                        {messages.map((msg, i) => (
                            <div key={msg._id || i}
                                className={`${msg.sender._id === "ai" ? "max-w-80" : "max-w-52"} 
                                    ${msg.sender._id === user._id ? "ml-auto" : ""} 
                                    message p-2 bg-slate-50 rounded-md`}>
                                <small className="text-xs opacity-70">{msg.sender.email}</small>
                                <div className="text-sm">
                                    {msg.sender._id === "ai"
                                        ? WriteAiMessage(msg.message)
                                        : <p>{msg.message}</p>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="inputField w-full flex absolute bottom-0">
                        <input
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            className="p-2 px-4 flex-grow bg-white"
                            placeholder="Enter message..."
                        />
                        <button onClick={send} className="px-5 bg-slate-950 text-white">
                            <i className="ri-send-plane-fill"></i>
                        </button>
                    </div>
                </div>

                {/* SIDE Collaborators Panel */}
                <div className={`sidePanel absolute top-0 h-full w-full bg-slate-50 transition-all 
                    ${isSidePanelOpen ? "translate-x-0" : "-translate-x-full"}`}>
                    <header className='flex justify-between p-2 bg-slate-200'>
                        <h1 className='font-semibold'>Collaborators</h1>
                        <button onClick={() => setIsSidePanelOpen(false)}><i className="ri-close-fill"></i></button>
                    </header>

                    <div className="users flex flex-col gap-2 p-2">
                        {project.users?.map(u => (
                            <div key={u._id} className="p-2 flex gap-2 items-center bg-slate-100 rounded">
                                <div className="rounded-full bg-slate-600 text-white p-3">
                                    <i className="ri-user-fill"></i>
                                </div>
                                <h1>{u.email}</h1>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* RIGHT CODE PANEL */}
            <section className="right bg-red-50 flex-grow h-full flex">
                
                {/* File Explorer */}
                <div className="explorer min-w-52 bg-slate-200">
                    <div className="file-tree">
                        {Object.keys(fileTree).map((file, i) => (
                            <button key={i}
                                onClick={() => { setCurrentFile(file); setOpenFiles(prev => [...new Set([...prev, file])]) }}
                                className="p-2 px-4 bg-slate-300 w-full text-left">
                                {file}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Editor */}
                <div className="code-editor flex flex-col flex-grow">
                    <div className="top flex justify-between items-center bg-white p-2">

                        <div className="files flex">
                            {openFiles.map((f, i) => (
                                <button key={i}
                                    onClick={() => setCurrentFile(f)}
                                    className={`p-2 px-4 ${currentFile === f ? "bg-slate-400" : "bg-slate-300"}`}>
                                    {f}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => alert("Vercel does NOT support WebContainer.\nRun works only on localhost.")}
                            className="bg-slate-700 text-white px-4 py-2 rounded">
                            Run
                        </button>
                    </div>

                    <div className="bottom flex flex-grow overflow-auto">
                        {fileTree[currentFile] && (
                            <div className="code-editor-area flex-grow bg-white">
                                <pre>
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
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Add Collaborator Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-md w-96 relative">

                        <header className='flex justify-between'>
                            <h2 className='text-xl font-semibold'>Select User</h2>
                            <button onClick={() => setIsModalOpen(false)}>
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>

                        <div className="users-list max-h-96 overflow-auto mt-4">
                            {users.map(u => (
                                <div key={u._id}
                                    onClick={() => handleUserClick(u._id)}
                                    className={`p-2 flex gap-2 items-center cursor-pointer
                                    ${selectedUserId.has(u._id) ? 'bg-slate-200' : ''}`}>
                                    <div className="p-4 rounded-full bg-slate-600 text-white">
                                        <i className="ri-user-fill"></i>
                                    </div>
                                    <h1>{u.email}</h1>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addCollaborators}
                            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded">
                            Add Collaborators
                        </button>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project
