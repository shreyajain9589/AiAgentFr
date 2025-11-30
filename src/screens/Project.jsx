import React, { useState, useEffect, useContext, useRef } from "react";
import { UserContext } from "../context/user.context";
import { useLocation } from "react-router-dom";
import axios from "../config/axios";
import { initializeSocket, receiveMessage, sendMessage } from "../config/socket";
import Markdown from "markdown-to-jsx";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";   // ⭐ FIXED

/* ---------------------- CODE HIGHLIGHT ---------------------- */
function SyntaxHighlightedCode(props) {
    const ref = useRef(null);

    useEffect(() => {
        if (ref.current && props.className?.includes("lang-")) {
            hljs.highlightElement(ref.current);
            ref.current.removeAttribute("data-highlighted");
        }
    }, [props.className, props.children]);

    return <code {...props} ref={ref} />;
}

const Project = () => {

    const location = useLocation();
    const { user } = useContext(UserContext);

    const initialProject = location.state?.project || {};

    const [project, setProject] = useState(initialProject);
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState(initialProject.messages || []);

    const [fileTree, setFileTree] = useState(initialProject.fileTree || {});
    const [currentFile, setCurrentFile] = useState(null);
    const [openFiles, setOpenFiles] = useState([]);

    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(new Set());
    const [message, setMessage] = useState("");

    const messageBox = useRef(null);

    /* ---------------------- AUTO-SCROLL ---------------------- */
    useEffect(() => {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight;
        }
    }, [messages]);

    /* ---------------------- INITIAL LOAD ---------------------- */
    useEffect(() => {
        if (!project?._id) return;

        initializeSocket(project._id);

        axios.get(`/projects/get-project/${project._id}`).then((res) => {
            setProject(res.data.project);
            setFileTree(res.data.project.fileTree || {});
        });

        axios.get(`/projects/messages/${project._id}`).then((res) => {
            setMessages(res.data.messages);
        });

        axios.get("/users/all").then((res) => setUsers(res.data.users));

        /* SOCKET MESSAGE LISTENER */
        receiveMessage("project-message", (data) => {

            if (data.sender._id === user._id) return;

            setMessages(prev => [...prev, data]);

            if (data.sender._id === "ai" && data.fileTree) {
                const newTree = data.fileTree;

                const updatedTree = { ...fileTree, ...newTree };
                setFileTree(updatedTree);

                const newFiles = Object.keys(newTree);
                if (newFiles.length > 0) {
                    setOpenFiles(prev => [...new Set([...prev, newFiles[0]])]);
                    setCurrentFile(newFiles[0]);
                }
            }
        });
    }, []);

    /* ---------------------- SELECT USER ---------------------- */
    const handleUserClick = (id) => {
        setSelectedUserId(prev => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });
    };

    /* ---------------------- ADD COLLAB ---------------------- */
    async function addCollaborators() {
        await axios.put("/projects/add-user", {
            projectId: project._id,
            users: Array.from(selectedUserId),
        });

        const res = await axios.get(`/projects/get-project/${project._id}`);
        setProject(res.data.project);

        setSelectedUserId(new Set());
        setIsModalOpen(false);
    }

    /* ---------------------- REMOVE COLLAB ---------------------- */
    async function removeCollaborator(userId) {
        await axios.put("/projects/remove-user", {
            projectId: project._id,
            userId,
        });

        const res = await axios.get(`/projects/get-project/${project._id}`);
        setProject(res.data.project);
    }

    /* ---------------------- SEND MESSAGE ---------------------- */
    const send = async () => {
        const text = message.trim();
        if (!text) return;

        const payload = {
            projectId: project._id,
            sender: { _id: user._id, email: user.email },
            message: text,
        };

        const res = await axios.post("/projects/message", payload);
        const savedMessage = res.data.message;

        setMessages(prev => [...prev, savedMessage]);
        sendMessage("project-message", savedMessage);

        setMessage("");
    };

    /* ---------------------- AI HTML RENDER ---------------------- */
    function WriteAiMessage(msg) {
        const obj = JSON.parse(msg);
        return (
            <div className="overflow-auto bg-slate-900 text-white rounded p-2">
                <Markdown children={obj.text} />
            </div>
        );
    }

    /* ---------------------- SAVE FILE TREE ---------------------- */
    const saveFileTree = (ft) => {
        axios.put("/projects/update-file-tree", {
            projectId: project._id,
            fileTree: ft,
        });
    };

    return (
        <main className="h-screen w-screen flex overflow-hidden">

            {/* ---- LEFT CHAT PANEL ---- */}
            <section className="left flex flex-col h-full min-w-96 bg-slate-300 relative">

                <header className="flex justify-between items-center p-2 px-4 bg-slate-100">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-slate-800 text-white px-3 py-1 rounded"
                    >
                        <i className="ri-add-fill"></i> Add collaborator
                    </button>

                    <button onClick={() => setIsSidePanelOpen(true)}>
                        <i className="ri-group-fill text-xl"></i>
                    </button>
                </header>

                <div className="pt-14 pb-12 flex flex-col flex-grow overflow-hidden">
                    <div
                        ref={messageBox}
                        className="flex-grow p-2 flex flex-col gap-2 overflow-y-auto"
                    >
                        {messages.map((msg, i) => (
                            <div
                                key={msg._id || i}
                                className={`p-2 rounded bg-white max-w-80 ${
                                    msg.sender._id === user._id ? "ml-auto" : ""
                                }`}
                            >
                                <small className="opacity-60 text-xs">{msg.sender.email}</small>
                                <div>
                                    {msg.sender._id === "ai"
                                        ? WriteAiMessage(msg.message)
                                        : msg.message}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="absolute bottom-0 left-0 w-full flex bg-white">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="flex-grow p-2 px-3 outline-none"
                            placeholder="Enter message..."
                        />
                        <button onClick={send} className="bg-slate-900 text-white px-5">
                            <i className="ri-send-plane-fill"></i>
                        </button>
                    </div>
                </div>

                {/* ---- COLLAB LIST ---- */}
                {isSidePanelOpen && (
                    <div className="absolute inset-0 bg-slate-50 flex flex-col z-20">
                        <header className="flex justify-between p-2 bg-slate-200">
                            <h2 className="font-semibold">Collaborators</h2>
                            <button onClick={() => setIsSidePanelOpen(false)}>
                                <i className="ri-close-fill text-xl"></i>
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto p-2">
                            {project.users?.map((u) => (
                                <div
                                    key={u._id}
                                    className="flex items-center justify-between p-2 bg-slate-100 rounded mb-2"
                                >
                                    <span className="flex items-center gap-2">
                                        <div className="p-3 bg-slate-600 text-white rounded-full">
                                            <i className="ri-user-fill"></i>
                                        </div>
                                        {u.email}
                                    </span>

                                    <button
                                        onClick={() => removeCollaborator(u._id)}
                                        className="text-red-600 hover:text-red-800 text-xl"
                                    >
                                        <i className="ri-delete-bin-line"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* ---- RIGHT CODE PANEL ---- */}
            <section className="right flex-grow h-full flex">

                {/* FILELIST */}
                <div className="explorer min-w-52 bg-slate-200 overflow-auto">
                    {Object.keys(fileTree).map((file, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setCurrentFile(file);
                                setOpenFiles(prev => [...new Set([...prev, file])]);
                            }}
                            className="p-2 px-4 bg-slate-300 w-full text-left border-b"
                        >
                            {file}
                        </button>
                    ))}
                </div>

                {/* EDITOR */}
                <div className="code-editor flex flex-col flex-grow overflow-hidden">

                    <div className="top flex items-center justify-between bg-white p-2">

                        <div className="files flex">
                            {openFiles.map((f, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentFile(f)}
                                    className={`px-4 py-2 border ${
                                        currentFile === f ? "bg-slate-400" : "bg-slate-200"
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() =>
                                alert("⚠️ Vercel does NOT support WebContainer.\nRun works only locally.")
                            }
                            className="bg-slate-800 text-white px-4 py-1 rounded"
                        >
                            Run
                        </button>
                    </div>

                    <div className="bottom flex flex-grow overflow-auto">
                        {fileTree[currentFile] && (
                            <div className="flex-grow bg-white p-3">
                                <pre>
                                    <code
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                            const updated = e.target.innerText;
                                            const ft = {
                                                ...fileTree,
                                                [currentFile]: {
                                                    file: { contents: updated }
                                                },
                                            };
                                            setFileTree(ft);
                                            saveFileTree(ft);
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: hljs.highlight(
                                                "javascript",
                                                fileTree[currentFile].file.contents
                                            ).value,
                                        }}
                                    />
                                </pre>
                            </div>
                        )}
                    </div>

                </div>
            </section>

            {/* ---- ADD COLLAB MODAL ---- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="w-96 bg-white rounded-md p-4 flex flex-col max-h-[90vh]">

                        <div className="flex justify-between items-center border-b pb-2">
                            <h2 className="text-xl font-semibold">Select User</h2>
                            <button onClick={() => setIsModalOpen(false)}>
                                <i className="ri-close-fill text-xl"></i>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
                            {users.map((u) => (
                                <div
                                    key={u._id}
                                    onClick={() => handleUserClick(u._id)}
                                    className={`p-2 flex items-center gap-2 cursor-pointer rounded ${
                                        selectedUserId.has(u._id)
                                            ? "bg-slate-300"
                                            : "hover:bg-slate-200"
                                    }`}
                                >
                                    <div className="p-3 bg-slate-600 text-white rounded-full">
                                        <i className="ri-user-fill"></i>
                                    </div>
                                    <span>{u.email}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addCollaborators}
                            className="mt-3 w-full bg-blue-600 text-white py-2 rounded"
                        >
                            Add Collaborators
                        </button>

                    </div>
                </div>
            )}

        </main>
    );
};

export default Project;
