import React, { useState, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from '../config/axios'
import { UserContext } from '../context/user.context'

const Login = () => {

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const { setUser } = useContext(UserContext)

    const navigate = useNavigate()

    async function submitHandler(e) {
        e.preventDefault()

        try {
            const res = await axios.post('/users/login', { email, password })

            localStorage.setItem("token", res.data.token);
            localStorage.setItem("user", JSON.stringify(res.data.user));

            setUser(res.data.user)
            navigate('/')

        } catch (err) {
            console.log(err.response?.data)

            // ⭐ Handle specific error messages
            const msg = err.response?.data?.message || "Something went wrong"

            if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("no user")) {
                window.alert("❌ This email is not registered. Please sign up first.")
            } 
            else if (msg.toLowerCase().includes("invalid password")) {
                window.alert("❌ Incorrect password. Please try again.")
            } 
            else {
                window.alert("❌ Login failed! " + msg)
            }
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold text-white mb-6">Login</h2>

                <form onSubmit={submitHandler}>
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2">Email</label>
                        <input
                            onChange={(e) => setEmail(e.target.value)}
                            type="email"
                            className="w-full p-3 rounded bg-gray-700 text-white"
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-gray-400 mb-2">Password</label>
                        <input
                            onChange={(e) => setPassword(e.target.value)}
                            type="password"
                            className="w-full p-3 rounded bg-gray-700 text-white"
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full p-3 rounded bg-blue-500 text-white hover:bg-blue-600"
                    >
                        Login
                    </button>
                </form>

                <p className="text-gray-400 mt-4">
                    Don't have an account?{" "}
                    <Link to="/register" className="text-blue-500">Register</Link>
                </p>
            </div>
        </div>
    )
}

export default Login
