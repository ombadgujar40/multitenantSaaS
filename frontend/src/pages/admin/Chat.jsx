import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, User } from "lucide-react";

export default function Chat() {
  const [messages, setMessages] = useState([
    { id: "1", sender: "Admin", text: "Hey team, progress update?" },
    { id: "2", sender: "Aarav", text: "Frontend design is 70% done!" },
  ]);
  const [text, setText] = useState("");

  const sendMessage = () => {
    if (text.trim() === "") return;
    setMessages([...messages, { id: Date.now().toString(), sender: "Admin", text }]);
    setText("");
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-4xl font-bold mb-2">Team Chat</h1>
      <p className="text-muted-foreground mb-4">Collaborate with your team in real-time</p>

      <Card className="flex flex-col h-[500px]">
        <CardHeader>
          <CardTitle>Chat Room</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          <div className="space-y-3 overflow-y-auto p-2 max-h-[360px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-xl w-fit ${
                  msg.sender === "Admin"
                    ? "bg-primary text-white self-end ml-auto"
                    : "bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" /> <strong>{msg.sender}</strong>
                </div>
                <p>{msg.text}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Input
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <Button onClick={sendMessage}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
