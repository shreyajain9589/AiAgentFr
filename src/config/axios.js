import axios from 'axios';


const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // Replace with your backend API URL
   withCredentials: true,
   headers: {
     "Content-Type": "application/json", 
     "Authorization": `Bearer ${localStorage.getItem('token')}`,
   },
});

export default axiosInstance;