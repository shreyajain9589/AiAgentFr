import React, { useState, useEffect, useContext, useRef } from "react";
import { UserContext } from "../context/user.context";
import { useLocation } from "react-router-dom";
import axios from "../config/axios";
import { initializeSocket, receiveMessage, sendMessage } from "../config/socket";
import Markdown from "markdown-to-jsx";
import hljs from "highlight.js";

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

    const messageBox = useRef(null); // SCROLL FIX

    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState(location.state.project.messages || []);

    const [fileTree, setFileTree] = useState({});
    const [currentFile, setCurrentFile] = useState(null);
    const [openFiles, setOpenFiles] = useState([]);

    const handleUserClick = (id) => {
        setSelectedUserId((prev) => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });
    };

    // AUTO-SCROLL FIX
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
            <div className="overflow-auto bg-slate-900 text-white rounded p-2">
                <Markdown children={obj.text} />
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

    return (
        <main className="h-screen w-screen flex">

            {/* LEFT CHAT PANEL */}
            <section className="left flex flex-col h-full min-w-96 bg-slate-300 relative">

                {/* HEADER */}
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

                {/* CHAT AREA (SCROLL FIX) */}
                <div className="pt-14 pb-12 flex flex-col flex-grow overflow-hidden">
                    <div
                        ref={messageBox}
                        className="flex-grow p-2 flex flex-col gap-2 overflow-y-auto"
                        style={{ maxHeight: "100%" }} // IMPORTANT FIX
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

                    {/* INPUT */}
                    <div className="absolute bottom-0 left-0 w-full flex bg-white">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Enter message..."
                            className="flex-grow p-2 px-3 outline-none"
                        />
                        <button onClick={send} className="bg-slate-900 text-white px-4">
                            <i className="ri-send-plane-fill"></i>
                        </button>
                    </div>
                </div>

                {/* COLLABORATORS PANEL */}
                {isSidePanelOpen && (
                    <div className="absolute inset-0 bg-slate-50 flex flex-col z-10">

                        <header className="flex justify-between p-2 bg-slate-200">
                            <h2 className="font-semibold">Collaborators</h2>
                            <button onClick={() => setIsSidePanelOpen(false)}>
                                <i className="ri-close-fill text-xl"></i>
                            </button>
                        </header>

                        {/* Scroll only list, not whole page */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {project.users?.map((u) => (
                                <div key={u._id} className="flex items-center gap-2 p-2 bg-slate-100 rounded mb-2">
                                    <div className="p-3 bg-slate-600 text-white rounded-full">
                                        <i className="ri-user-fill"></i>
                                    </div>
                                    <span>{u.email}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* RIGHT CODE AREA (unchanged) */}
            <section className="right flex-grow bg-red-50"></section>

            {/* ADD COLLABORATOR MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="w-96 bg-white rounded-md p-4 flex flex-col max-h-[90vh]">

                        {/* MODAL HEADER */}
                        <div className="flex justify-between items-center border-b pb-2">
                            <h2 className="text-xl font-semibold">Select User</h2>
                            <button onClick={() => setIsModalOpen(false)}>
                                <i className="ri-close-fill text-xl"></i>
                            </button>
                        </div>

                        {/* ONLY LIST SCROLLS */}
                        <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
                            {users.map((u) => (
                                <div
                                    key={u._id}
                                    onClick={() => handleUserClick(u._id)}
                                    className={`p-2 flex items-center gap-2 rounded cursor-pointer ${
                                        selectedUserId.has(u._id)
                                            ? "bg-slate-200"
                                            : "hover:bg-slate-100"
                                    }`}
                                >
                                    <div className="p-3 bg-slate-600 text-white rounded-full">
                                        <i className="ri-user-fill"></i>
                                    </div>
                                    <span>{u.email}</span>
                                </div>
                            ))}
                        </div>

                        {/* BUTTON AT BOTTOM */}
                        <button
                            onClick={addCollaborators}
                            className="mt-3 w-full py-2 bg-blue-600 text-white rounded"
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
