import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import api from "@/api/axios"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, User, Users } from "lucide-react";

/**
 * Props:
 * - token (optional) : JWT string (if not provided, it will try localStorage.getItem('token'))
 * - socketUrl (optional) : full socket server url (defaults to NEXT_PUBLIC_SOCKET_URL or window.location.origin)
 * - apiUrl (optional) : REST API base url (defaults to NEXT_PUBLIC_API_URL or http://127.0.0.1:2000)
 */
export default function Chat({ token: tokenProp, socketUrl: socketUrlProp, apiUrl: apiUrlProp }) {
  const [groups, setGroups] = useState([]);
  const [messagesByGroup, setMessagesByGroup] = useState({});
  const [activeGroup, setActiveGroup] = useState(null);
  const [text, setText] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const scrollRef = useRef(null);
  const socketRef = useRef(null);
  const joinedRoomRef = useRef(null);
  const myUserIdRef = useRef(null);

  // const API_URL = apiUrlProp || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:2000";
  const API_URL = "http://127.0.0.1:2000";
  // const SOCKET_URL = socketUrlProp || process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== "undefined" && window.location.origin) || "http://127.0.0.1:2000";
  const SOCKET_URL = "http://127.0.0.1:2000";

  const getToken = () => {
    if (tokenProp) return tokenProp;
    try {
      return localStorage.getItem("token");
    } catch (e) {
      return null;
    }
  };

  // Initialize socket once
  useEffect(() => {
    const token = getToken();
    const sock = io(SOCKET_URL, {
      auth: { token: token ? `Bearer ${token}` : null },
      transports: ["websocket"],
      autoConnect: true,
    });

    socketRef.current = sock;

    sock.on("connect_error", (err) => {
      console.error("Socket connect_error:", err.message || err);
    });

    sock.on("connect", () => {
      console.log("Socket connected:", sock.id);
    });
    if (!token) return;

    // accept "Bearer <token>" or raw token
    const raw = typeof token === "string" && token.startsWith("Bearer ") ? token.split(" ")[1] : token;

    try {
      const payload = JSON.parse(atob(raw.split('.')[1])); // decode JWT payload
      myUserIdRef.current = payload.id ?? payload.sub ?? null;
    } catch (e) {
      // not a JWT or decode failed — leave null
      myUserIdRef.current = null;
    }

    // socket returns messages array for a group when joined
    sock.on("group_messages", (msgs) => {
      const room = joinedRoomRef.current;
      if (!room) return;
      const groupId = room.replace("group_", "");
      setMessagesByGroup((prev) => {
        const existing = prev[groupId] || [];
        const all = [...existing, ...msgs];
        const byId = new Map();
        all.forEach((m) => byId.set(String(m.id), m));
        const merged = Array.from(byId.values()).sort((a, b) => {
          if (a.createdAt && b.createdAt) return new Date(a.createdAt) - new Date(b.createdAt);
          return (a.id || 0) - (b.id || 0);
        });
        return { ...prev, [groupId]: merged };
      });
    });

    // realtime new messages
    sock.on("new_message", (msg) => {
      const groupId = String(msg.groupId);
      setMessagesByGroup((prev) => {
        const arr = prev[groupId] ? [...prev[groupId]] : [];
        if (!arr.some((m) => String(m.id) === String(msg.id))) {
          arr.push(msg);
        }
        return { ...prev, [groupId]: arr };
      });
    });

    sock.on("error", (err) => {
      console.error("Socket error event:", err);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SOCKET_URL]);

  // Fetch groups on mount
  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) {
      console.warn("No token found for fetching groups");
      return;
    }

    const fetchGroups = async () => {
      setLoadingGroups(true);
      try {
        const res = await api.get(`${API_URL}/chat/groups`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const data = Array.isArray(res.data) ? res.data : res.data.groups || [];
        setGroups(data);

        // set active group if none (pick first)
        if (!activeGroup && data.length > 0) {
          setActiveGroup(String(data[0].id));
        }
      } catch (err) {
        console.error("Failed to fetch groups:", err);
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    };

    fetchGroups();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_URL, tokenProp]);



  // When activeGroup changes: join socket room & fetch messages (REST)
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock || !activeGroup) return;

    // leave previous
    const prevRoom = joinedRoomRef.current;
    if (prevRoom) {
      const prevGroupId = prevRoom.replace("group_", "");
      sock.emit("leave_group", { groupId: prevGroupId });
      joinedRoomRef.current = null;
    }

    // join via socket (server will emit group_messages)
    sock.emit("join_group", { groupId: activeGroup });
    joinedRoomRef.current = `group_${activeGroup}`;

    // also fetch messages via REST to ensure initial load (in case socket doesn't respond)
    let cancelled = false;
    const token = getToken();
    if (token) {
      setLoadingMessages(true);
      api
        .get(`${API_URL}/chat/groups/${activeGroup}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 200 },
        })
        .then((res) => {
          if (cancelled) return;
          const msgs = Array.isArray(res.data) ? res.data : res.data.messages || [];
          setMessagesByGroup((prev) => ({ ...prev, [activeGroup]: msgs }));
        })
        .catch((err) => {
          // it's ok if REST fails; socket may supply messages
          console.error("Failed to fetch messages (REST):", err);
        })
        .finally(() => {
          if (!cancelled) setLoadingMessages(false);
        });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup, API_URL]);

  // auto-scroll when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 50);
    }
  }, [activeGroup, messagesByGroup]);

  const sendMessage = () => {
    if (text.trim() === "") return;
    const sock = socketRef.current;
    if (!sock || !sock.connected) {
      // optimistic local add
      setMessagesByGroup((prev) => {
        const arr = prev[activeGroup] ? [...prev[activeGroup]] : [];
        arr.push({ id: `local-${Date.now()}`, text: text.trim(), sender: "Me" });
        return { ...prev, [activeGroup]: arr };
      });
      setText("");
      return;
    }
    sock.emit("send_message", { groupId: activeGroup, text: text.trim() });
    setText("");
  };

  const isMine = (msg) => {
    const myId = myUserIdRef.current;
    if (!myId) return false;
    // message might use senderId or sender (if you stored names); prefer senderId
    return String(msg.senderId ?? msg.sender) === String(myId);
  };



  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Chat</h1>
          <p className="text-muted-foreground">Collaborate with your groups in real-time</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left: Chat Window */}
        <div className="flex-1">
          <Card className="flex flex-col h-[600px]">
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5" />
                  <span>{groups.find((g) => String(g.id) === String(activeGroup))?.name || "—"}</span>
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col justify-between">
              <div
                ref={scrollRef}
                className="space-y-3 overflow-y-auto p-4 max-h-[480px]"
                aria-live="polite"
              >
                {loadingMessages && <div className="text-sm text-muted-foreground">Loading messages...</div>}

                {(messagesByGroup[activeGroup] || []).map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 border rounded-xl w-fit max-w-[80%] break-words shadow-sm ${isMine(msg)
                      ? "bg-primary rounded-lg text-white self-end ml-auto"
                      : "bg-muted rounded-lg"
                      }`}
                  >
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <User className="h-4 w-4" />
                      <strong>{msg.senderName || msg.sender || (msg.senderType ? `${msg.senderType}:${msg.senderId}` : "Unknown")}</strong>
                    </div>
                    <p>{msg.text}</p>
                  </div>
                ))}

                {(!loadingMessages && (messagesByGroup[activeGroup] || []).length === 0) && (
                  <p className="text-sm text-muted-foreground">No messages yet. Say hi 👋</p>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Input
                  placeholder="Type a message..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <Button onClick={sendMessage} aria-label="Send message">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Groups list */}
        <aside className="w-80">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>

            <CardContent className="overflow-y-auto p-2">
              {loadingGroups && <div className="text-sm text-muted-foreground mb-2">Loading groups...</div>}

              <ul className="space-y-2">
                {groups.map((g) => {
                  const isActive = String(g.id) === String(activeGroup);
                  return (
                    <li
                      key={g.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-lg cursor-pointer hover:shadow-md transition-shadow ${isActive ? "bg-primary/10 border border-primary" : "bg-card"
                        }`}
                      onClick={() => setActiveGroup(String(g.id))}
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-muted w-10 h-10 flex items-center justify-center">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium">{g.name}</div>
                          <div className="text-xs text-muted-foreground">{g.last || g.description || ""}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">{g.members || (g.memberCount ?? 0)} members</div>
                        {isActive && <div className="text-xs font-medium text-primary">Active</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>

            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
