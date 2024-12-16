import React, { useEffect, useRef } from "react";
import Codemirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import ACTIONS from "../Actions";

const Editor = ({ socketRef, roomId, onCodeChange }) => {
  const editorRef = useRef(null);
  const textareaRef = useRef(null);
  const isSyncing = useRef(false); // Prevent infinite loop during auto-sync

  // Initialize CodeMirror Editor
  useEffect(() => {
    editorRef.current = Codemirror.fromTextArea(textareaRef.current, {
      mode: { name: "javascript", json: true },
      theme: "dracula",
      autoCloseTags: true,
      autoCloseBrackets: true,
      lineNumbers: true,
    });

    // Emit code changes to the server
    editorRef.current.on("change", (instance, changes) => {
      const code = instance.getValue();

      if (!isSyncing.current) {
        onCodeChange(code);
        if (socketRef.current) {
          socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId, code });
        }
      }
    });

    return () => {
      if (editorRef.current) {
        editorRef.current.toTextArea(); // Clean up on unmount
      }
    };
  }, [roomId, socketRef, onCodeChange]);

  // Listen for code changes from the server and update the editor
  useEffect(() => {
    const currentSocketRef = socketRef.current; // Store the current value of socketRef

    if (currentSocketRef) {
      const handleCodeChange = ({ code }) => {
        if (code !== editorRef.current.getValue()) {
          isSyncing.current = true; // Prevent re-triggering 'change' event
          editorRef.current.setValue(code);
          isSyncing.current = false;
        }
      };

      // Listen for code changes from the server
      currentSocketRef.on(ACTIONS.CODE_CHANGE, handleCodeChange);

      // Cleanup the event listener on unmount using the stored socketRef
      return () => {
        currentSocketRef.off(ACTIONS.CODE_CHANGE, handleCodeChange);
      };
    }
  }, [socketRef, roomId]);

  return <textarea ref={textareaRef} id="realtimeEditor"></textarea>;
};

export default Editor;
