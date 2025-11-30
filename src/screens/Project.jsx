import React, { useState, useEffect, useContext, useRef } from "react";
import { UserContext } from "../context/user.context";
import { useLocation } from "react-router-dom";
import axios from "../config/axios";
import { initializeSocket, receiveMessage, sendMessage } from "../config/socket";
import Markdown from "markdown-to-jsx";
import hljs from "highlight.js";
import { getWebContainer } from "../config/webContainer";

function SyntaxHighlightedCode(props) {
    const ref = useRef(null);

    React.useEffect(() => {
        if (ref.current && props.className?.includes("lang-") && window.hljs) {
            window.hljs.highlightElement(ref.current);
            ref.current.removeAttribute("data-highlighted");
        }
    }, [props.className, props.children]);

    return <code {...props} ref={ref} />;
}

const Project = () => {
    const location = useLocation();
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(new Set());
    const [project, setProject] = useState(location.state.project);
    const [message, setMessage] = useState("");
    const { user } = useContext(UserContext);
    const messageBox = useRef(null);

    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState(location.state.project.messages || []);
    const [fileTree, setFileTree] = useState({});
    const [currentFile, setCurrentFile] = useState(null);
    const [openFiles, setOpenFiles] = useState([]);

    const [webContainer, setWebContainer] = useState(null);
    const [iframeUrl, setIframeUrl] = useState(null);

    const handleUserClick = (id) => {
        setSelectedUserId((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    useEffect(() => {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight;
        }
    }, [messages]);

    function addCollaborators() {
        axios
            .put("/projects/add-user", {
                projectId: project._id.toString(),
                users: Array.from(selectedUserId),
            })
            .then((res) => {
                setProject(res.data.project);
                setIsModalOpen(false);
            })
            .catch((err) => console.log(err));
    }

    const send = async () => {
        const text = message.trim();
        if (!text) return;

        const payload = {
            projectId: project._id,
            sender: { _id: user._id, email: user.email },
            message: text,
        };

        try {
            const res = await axios.post("/projects/message", payload);
            const savedMessage = res.data.message;

            setMessages((prev) => [...prev, savedMessage]);

            sendMessage("project-message", savedMessage);
            setMessage("");
        } catch (err) {
            console.log("Message error:", err);
        }
    };

    function WriteAiMessage(messageStr) {
        const obj = JSON.parse(messageStr);
        return (
            <div className="overflow-auto bg-slate-950 text-white rounded-sm p-2">
                <Markdown children={obj.text} options={{ overrides: { code: SyntaxHighlightedCode } }} />
            </div>
        );
    }

    useEffect(() => {
        initializeSocket(project._id);

        axios.get(`/projects/get-project/${project._id}`).then((res) => {
            setProject(res.data.project);
            setFileTree(res.data.project.fileTree || {});
        });

        axios.get(`/projects/messages/${project._id}`).then((res) => {
            setMessages(res.data.messages);
        });

        axios.get("/users/all").then((res) => setUsers(res.data.users));
    }, []);

    function saveFileTree(ft) {
        axios.put("/projects/update-file-tree", {
            projectId: project._id,
            fileTree: ft,
        });
    }

    return (
        <main className="h-screen w-screen flex">

            {/* LEFT CHAT PANEL */}
            <section className="left relative flex flex-col h-full min-w-96 bg-slate-300">
                
                {/* HEADER */}
                <header className="flex justify-between items-center p-2 px-4 w-full bg-slate-100">
                    <button
                        className="flex items-center gap-2 bg-slate-800 text-white px-3 py-1 rounded hover:bg-slate-900"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <i className="ri-add-fill"></i>
                        Add collaborator
                    </button>

                    <button onClick={() => setIsSidePanelOpen(true)} className="p-2">
                        <i className="ri-group-fill text-xl"></i>
                    </button>
                </header>

                {/* CHAT AREA */}
                <div className="conversation-area pt-14 pb-10 flex-grow flex flex-col">
                    <div ref={messageBox} className="flex-grow p-1 flex flex-col gap-1 overflow-auto">
                        {messages.map((msg, i) => (
                            <div
                                key={msg._id || i}
                                className={`p-2 bg-slate-50 rounded-md max-w-80 ${
                                    msg.sender._id === user._id ? "ml-auto" : ""
                                }`}
                            >
                                <small className="text-xs opacity-70">{msg.sender.email}</small>
                                <div className="text-sm">
                                    {msg.sender._id === "ai" ? WriteAiMessage(msg.message) : msg.message}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* INPUT BOX */}
                    <div className="absolute bottom-0 w-full flex">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="p-2 px-4 flex-grow bg-white"
                            placeholder="Enter message..."
                        />
                        <button onClick={send} className="px-5 bg-slate-950 text-white">
                            <i className="ri-send-plane-fill"></i>
                        </button>
                    </div>
                </div>

                {/* COLLABORATORS SIDE PANEL */}
                {isSidePanelOpen && (
                    <div className="absolute inset-0 bg-slate-50 flex flex-col shadow-xl">

                        <header className="flex justify-between p-2 bg-slate-200">
                            <h1 className="font-semibold">Collaborators</h1>
                            <button onClick={() => setIsSidePanelOpen(false)}>
                                <i className="ri-close-fill text-xl"></i>
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto px-3 py-2">
                            {project.users?.map((u) => (
                                <div key={u._id} className="flex gap-2 items-center p-2 bg-slate-100 rounded mb-2">
                                    <div className="bg-slate-600 text-white p-3 rounded-full flex items-center justify-center">
                                        <i className="ri-user-fill"></i>
                                    </div>
                                    <h1 className="text-sm">{u.email}</h1>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* RIGHT SECTION (NO CHANGE) */}
            <section className="right flex-grow bg-red-50">
                {/* your editor code stays unchanged */}
            </section>

            {/* ADD COLLABORATOR MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded-md w-96 max-h-[85vh] flex flex-col shadow-xl">

                        {/* HEADER */}
                        <header className="flex justify-between items-center border-b pb-2">
                            <h2 className="text-xl font-semibold">Select User</h2>
                            <button onClick={() => setIsModalOpen(false)}>
                                <i className="ri-close-fill text-xl"></i>
                            </button>
                        </header>

                        {/* SCROLLING LIST ONLY */}
                        <div className="flex-1 overflow-y-auto mt-3 pr-2">
                            {users.map((u) => (
                                <div
                                    key={u._id}
                                    onClick={() => handleUserClick(u._id)}
                                    className={`p-2 flex items-center gap-2 cursor-pointer rounded mb-2 ${
                                        selectedUserId.has(u._id)
                                            ? "bg-slate-200"
                                            : "bg-white hover:bg-slate-100"
                                    }`}
                                >
                                    <div className="p-3 rounded-full bg-slate-600 text-white">
                                        <i className="ri-user-fill"></i>
                                    </div>
                                    <h1>{u.email}</h1>
                                </div>
                            ))}
                        </div>

                        {/* BUTTON AT BOTTOM (FIXED) */}
                        <button
                            onClick={addCollaborators}
                            className="mt-3 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
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
