import { io } from "socket.io-client";

// Point this to the backend server
const socket = io("http://localhost:4000", {
    transports: ["websocket"]
});

export default socket;
