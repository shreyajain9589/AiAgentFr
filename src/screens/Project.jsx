import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useNavigate, useLocation } from 'react-router-dom'
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
    const [messages, setMessages] = useState([])
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

    // Scroll to bottom on messages change
    useEffect(() => {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight
        }
    }, [messages])

    function addCollaborators() {
        axios.put("/projects/add-user", {
            projectId: project._id.toString(),
            users: Array.from(selectedUserId)
        }).then(res => {
            console.log(res.data)
            setIsModalOpen(false)
        }).catch(err => console.log(err))
    }

    // Send: save to backend then emit socket
    const send = async () => {
        const text = message?.trim()
        if (!text) return

        const payload = {
            projectId: project._id,
            sender: { _id: user._id, email: user.email },
            message: text
        }

        try {
            // Save message to DB (backend should return saved message object)
            const res = await axios.post('/projects/message', payload)
            const savedMessage = res.data.message

            // Append locally (savedMessage from server should include createdAt/_id)
            setMessages(prev => [...prev, savedMessage])

            // Emit socket so other clients receive it in realtime
            sendMessage('project-message', savedMessage)

            setMessage("")
        } catch (err) {
            console.error("Failed to send message:", err)
        }
    }

    function WriteAiMessage(messageStr) {
        const messageObject = JSON.parse(messageStr)
        return (
            <div className='overflow-auto bg-slate-950 text-white rounded-sm p-2'>
                <Markdown
                    children={messageObject.text}
                    options={{
                        overrides: {
                            code: SyntaxHighlightedCode,
                        },
                    }}
                />
            </div>
        )
    }

    useEffect(() => {
        // initialize socket with project id
        initializeSocket(project._id)

        // WebContainer: only attempt in dev/local
        if (!import.meta.env.PROD) {
            getWebContainer().then(container => {
                setWebContainer(container)
                console.log("WebContainer started")
            }).catch(e => console.warn("WebContainer boot failed:", e))
        } else {
            console.warn("WebContainer disabled on production")
        }

        // receive socket messages
        receiveMessage('project-message', (data) => {
            // data is expected to be message object saved by backend
            console.log("socket msg received:", data)
            // Avoid adding duplicate if it's the same as the one we already appended from POST (optional)
            setMessages(prev => {
                // simple duplicate check by _id if present
                if (data._id && prev.find(m => m._id === data._id)) return prev
                return [...prev, data]
            })
            // if ai includes fileTree, mount locally (dev only)
            if (data.sender?._id === 'ai' && data.fileTree && !import.meta.env.PROD && webContainer) {
                try { webContainer.mount(data.fileTree) } catch (e) { console.warn(e) }
            }
        })

        // load project and fileTree
        axios.get(`/projects/get-project/${project._id}`).then(res => {
            setProject(res.data.project)
            setFileTree(res.data.project.fileTree || {})
        }).catch(e => console.log(e))

        // load past messages
        axios.get(`/projects/messages/${project._id}`).then(res => {
            // expected { messages: [...] }
            setMessages(res.data.messages || [])
        }).catch(err => {
            console.log("Failed to load messages:", err)
        })

        // load users for modal
        axios.get('/users/all').then(res => {
            setUsers(res.data.users)
        }).catch(err => console.log(err))

        // cleanup on unmount: (optional) disconnect socket
        return () => {
            // optional: if you want to disconnect socket on leaving
            // const s = getSocket(); if (s) s.disconnect();
        }
    }, [])

    function saveFileTree(ft) {
        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).then(res => {
            console.log(res.data)
        }).catch(err => console.log(err))
    }

    return (
        <main className='h-screen w-screen flex'>
            <section className="left relative flex flex-col h-screen min-w-96 bg-slate-300">
                <header className='flex justify-between items-center p-2 px-4 w-full bg-slate-100 absolute z-10 top-0'>
                    <button className='flex gap-2' onClick={() => setIsModalOpen(true)}>
                        <i className="ri-add-fill mr-1"></i>
                        <p>Add collaborator</p>
                    </button>
                    <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2'>
                        <i className="ri-group-fill"></i>
                    </button>
                </header>

                <div className="conversation-area pt-14 pb-10 flex-grow flex flex-col relative">

                    <div ref={messageBox} className="message-box p-1 flex-grow flex flex-col gap-1 overflow-auto">
                        {messages.map((msg, index) => (
                            <div key={msg._id || index}
                                className={`${msg.sender._id === 'ai' ? 'max-w-80' : 'max-w-52'} 
                                ${msg.sender._id == user._id && 'ml-auto'} message flex flex-col p-2
                                bg-slate-50 w-fit rounded-md`}>
                                <small className='opacity-65 text-xs'>{msg.sender.email}</small>
                                <div className='text-sm'>
                                    {msg.sender._id === 'ai'
                                        ? WriteAiMessage(msg.message)
                                        : <p>{msg.message}</p>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="inputField w-full flex absolute bottom-0">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className='p-2 px-4 flex-grow bg-white'
                            placeholder='Enter message'
                        />
                        <button onClick={send} className='px-5 bg-slate-950 text-white'>
                            <i className="ri-send-plane-fill"></i>
                        </button>
                    </div>
                </div>

                <div className={`sidePanel w-full h-full bg-slate-50 absolute transition-all 
                    ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0`}>

                    <header className='flex justify-between p-2 bg-slate-200'>
                        <h1 className='font-semibold text-lg'>Collaborators</h1>
                        <button onClick={() => setIsSidePanelOpen(false)} className='p-2'>
                            <i className="ri-close-fill"></i>
                        </button>
                    </header>

                    <div className="users flex flex-col gap-2">
                        {project.users?.map(user => (
                            <div key={user._id} className="user p-2 flex gap-2 items-center">
                                <div className='aspect-square p-5 bg-slate-600 rounded-full text-white'>
                                    <i className="ri-user-fill"></i>
                                </div>
                                <h1>{user.email}</h1>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="right bg-red-50 flex-grow h-full flex">
                <div className="explorer bg-slate-200 min-w-52">
                    <div className="file-tree">
                        {Object.keys(fileTree).map((file, index) => (
                            <button key={index}
                                onClick={() => {
                                    setCurrentFile(file)
                                    setOpenFiles(prev => [...new Set([...prev, file])])
                                }}
                                className="tree-element cursor-pointer p-2 px-4 bg-slate-300 w-full">
                                <p className='font-semibold text-lg'>{file}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="code-editor flex flex-col flex-grow">
                    <div className="top flex justify-between">
                        <div className="files flex">
                            {openFiles.map((file, index) => (
                                <button key={index}
                                    onClick={() => setCurrentFile(file)}
                                    className={`open-file p-2 px-4 bg-slate-300 
                                    ${currentFile === file ? 'bg-slate-400' : ''}`}>
                                    <p className='font-semibold text-lg'>{file}</p>
                                </button>
                            ))}
                        </div>

                        <div className="actions flex gap-2">
                            <button
                                onClick={async () => {
                                    if (import.meta.env.PROD) {
                                        alert("Run is disabled on production (WebContainer not supported).");
                                        return;
                                    }
                                    if (!webContainer) {
                                        alert("WebContainer is not ready.");
                                        return;
                                    }
                                    await webContainer.mount(fileTree)
                                    const installProcess =
                                        await webContainer.spawn("npm", ["install"])
                                    installProcess.output.pipeTo(new WritableStream({
                                        write(chunk) {
                                            console.log(chunk)
                                        }
                                    }))
                                    if (runProcess) runProcess.kill()
                                    let tempRun = await webContainer.spawn("npm", ["start"])
                                    tempRun.output.pipeTo(new WritableStream({
                                        write(chunk) {
                                            console.log(chunk)
                                        }
                                    }))
                                    setRunProcess(tempRun)
                                    webContainer.on('server-ready', (port, url) => {
                                        setIframeUrl(url)
                                    })
                                }}
                                className='p-2 px-4 bg-slate-300 text-white'>
                                run
                            </button>
                        </div>
                    </div>

                    <div className="bottom flex flex-grow overflow-auto">
                        {fileTree[currentFile] && (
                            <div className="code-editor-area flex-grow bg-slate-50 overflow-auto">
                                <pre className="hljs h-full">
                                    <code
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                            const updatedContent = e.target.innerText;
                                            const ft = {
                                                ...fileTree,
                                                [currentFile]: {
                                                    file: {
                                                        contents: updatedContent
                                                    }
                                                }
                                            }
                                            setFileTree(ft)
                                            saveFileTree(ft)
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: hljs.highlight(
                                                'javascript',
                                                fileTree[currentFile].file.contents
                                            ).value
                                        }}
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            paddingBottom: '25rem',
                                        }}
                                    />
                                </pre>
                            </div>
                        )}
                    </div>
                </div>

                {!import.meta.env.PROD && iframeUrl && webContainer && (
                    <div className="flex min-w-96 flex-col h-full">
                        <div className="address-bar">
                            <input
                                type="text"
                                value={iframeUrl}
                                onChange={(e) => setIframeUrl(e.target.value)}
                                className="w-full p-2 px-4 bg-slate-200"
                            />
                        </div>
                        <iframe src={iframeUrl} className="w-full h-full"></iframe>
                    </div>
                )}
            </section>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-md w-96 relative">

                        <header className='flex justify-between'>
                            <h2 className='text-xl font-semibold'>Select User</h2>
                            <button onClick={() => setIsModalOpen(false)} className='p-2'>
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>

                        <div className="users-list max-h-96 overflow-auto mt-4">
                            {users.map(user => (
                                <div key={user._id}
                                    onClick={() => handleUserClick(user._id)}
                                    className={`user cursor-pointer p-2 flex gap-2 items-center
                                    ${selectedUserId.has(user._id) ? 'bg-slate-200' : ''}`}>
                                    <div className='p-5 bg-slate-600 rounded-full text-white'>
                                        <i className="ri-user-fill"></i>
                                    </div>
                                    <h1 className='font-semibold text-lg'>{user.email}</h1>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addCollaborators}
                            className='absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-600 text-white rounded-md'>
                            Add Collaborators
                        </button>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project
