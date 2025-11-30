import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Login from '../screens/Login';
import Register from '../screens/Register';
import Home from '../screens/Home';
import Project from '../screens/Project';
import UserAuth from '../auth/UserAuth';

const AppRoutes = () => {
    return (
        <BrowserRouter>
            <Routes>
                {/* Protected Routes */}
                <Route
                    path="/"
                    element={
                        <UserAuth>
                            <Home />
                        </UserAuth>
                    }
                />
                <Route
                    path="/project"
                    element={
                        <UserAuth>
                            <Project />
                        </UserAuth>
                    }
                />

                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
            </Routes>
        </BrowserRouter>
    );
};

export default AppRoutes;
