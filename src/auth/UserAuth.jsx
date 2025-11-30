import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../context/user.context';

const UserAuth = ({ children }) => {
    const { user } = useContext(UserContext);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token || !user) {
            navigate('/login');
            return;
        }

        // User exists and token exists
        setLoading(false);
    }, [token, user, navigate]);

    if (loading) {
        return <div className="p-4 text-center">Loading...</div>;
    }

    return <>{children}</>;
};

export default UserAuth;
