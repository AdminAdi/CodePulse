import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import ACTIONS from "../Actions";
import Client from "../components/Client";
import Editor from "../components/Editor";
import { initSocket } from "../socket";
import { useLocation, useNavigate, Navigate, useParams } from "react-router-dom";

const EditorPage = () => {
  const socketRef = useRef(null);
  const codeRef = useRef(""); // To store the current code
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();
  const [clients, setClients] = useState([]);
  const hasInitialized = useRef(false); // Prevent duplicate initialization

  useEffect(() => {
    const init = async () => {
      if (!location.state?.username) {
        toast.error("Invalid access, redirecting to home.");
        reactNavigator("/");
        return;
      }

      if (hasInitialized.current) return;
      hasInitialized.current = true;

      try {
        // Initialize socket connection
        socketRef.current = await initSocket();

        socketRef.current.on("connect_error", handleErrors);
        socketRef.current.on("connect_failed", handleErrors);

        function handleErrors(err) {
          console.error("Socket error:", err);
          toast.error("Socket connection failed, try again later.");
          reactNavigator("/");
        }

        // Emit JOIN event
        socketRef.current.emit(ACTIONS.JOIN, {
          roomId,
          username: location.state?.username,
        });

        // Handle JOINED event
        socketRef.current.on(ACTIONS.JOINED, ({ clients: newClients, username, socketId }) => {
          if (username !== location.state?.username) {
            toast.success(`${username} joined the room.`);
          }

          // Set unique clients
          setClients((prevClients) => {
            const allClients = [...prevClients, ...newClients];
            const uniqueClients = Array.from(
              new Map(allClients.map((client) => [client.socketId, client])).values()
            );
            return uniqueClients;
          });

          // Sync code with the newly joined client
          socketRef.current.emit(ACTIONS.SYNC_CODE, { code: codeRef.current, socketId });
        });

        // Listen for CODE_CHANGE events (dynamic updates)
        socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
          if (code !== codeRef.current) {
            codeRef.current = code;
            // Update the editor with the new code
            setEditorContent(code);
          }
        });

        // Handle DISCONNECTED event
        socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
          toast.success(`${username} left the room.`);
          setClients((prev) => prev.filter((client) => client.socketId !== socketId));
        });
      } catch (err) {
        console.error("Socket initialization failed:", err);
        toast.error("Something went wrong. Please try again.");
        reactNavigator("/");
      }
    };

    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.CODE_CHANGE);
        socketRef.current.off(ACTIONS.DISCONNECTED);
      }
    };
  }, [location.state?.username, reactNavigator, roomId]);

  const setEditorContent = (code) => {
    const editor = document.querySelector(".editor");
    if (editor) {
      editor.value = code; // Update the editor content
    }
  };

  const handleCodeChange = (code) => {
    codeRef.current = code; // Update the local code reference
    socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId, code }); // Emit the change
  };

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID has been copied to your clipboard");
    } catch (err) {
      toast.error("Could not copy the Room ID");
      console.error(err);
    }
  }

  function leaveRoom() {
    reactNavigator("/");
  }

  if (!location.state) {
    return <Navigate to="/" />;
  }

  return (
    <div className="mainWrap">
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img className="logoImage" src="/Code-Pulse.jpg" alt="logo" />
          </div>
          <h3>Connected</h3>
          <div className="clientsList">
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>
        <button className="btn copyBtn" onClick={copyRoomId}>
          Copy ROOM ID
        </button>
        <button className="btn leaveBtn" onClick={leaveRoom}>
          Leave
        </button>
      </div>
      <div className="editorWrap">
        <Editor
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={handleCodeChange} // Dynamic code change handler
        />
      </div>
    </div>
  );
};

export default EditorPage;
