import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import axios from "axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * ProjectDrawer
 * Props: open, onClose, project, token, org, isAdmin, dt, role
 */
export default function ProjectDrawer({
  open,
  onClose,
  project,
  token,
  org,
  isAdmin,
  dt,
  role,
}) {
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    assignedTo: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dt) setEmployees(dt);
  }, [dt]);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!project) return;
      try {
        const res = await axios.get(
          `http://127.0.0.1:2000/task/getProjectTasks/${project.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTasks(res.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch tasks");
      }
    };
    fetchTasks();
  }, [project, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTaskForm((p) => ({ ...p, [name]: value }));
  };

  const handleAddTask = async () => {
    if (!taskForm.title || !taskForm.assignedTo)
      return toast.error("Title and employee are required");

    setLoading(true);
    try {
      await axios.post(
        `http://127.0.0.1:2000/task/register`,
        {
          projectId: project.id,
          title: taskForm.title,
          description: taskForm.description,
          dueDate: taskForm.dueDate
            ? new Date(taskForm.dueDate).toISOString()
            : null,
          assignedToId: parseInt(taskForm.assignedTo),
          status: "pending",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Task assigned successfully!");
      setTaskForm({ title: "", description: "", dueDate: "", assignedTo: "" });

      // refresh tasks
      const res = await axios.get(
        `http://127.0.0.1:2000/task/getProjectTasks/${project.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTasks(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign task");
    } finally {
      setLoading(false);
    }
  };

  const markComplete = async (taskId) => {
    try {
      await axios.patch(
        `http://127.0.0.1:2000/task/update/${taskId}`,
        { status: "completed" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "completed" } : t))
      );
      toast.success("Marked completed");
    } catch (err) {
      console.error(err);
      toast.error("Could not update task");
    }
  };

  // === PORTAL TARGET: create synchronously (so createPortal always has a node) ===
  // If not running in a browser (SSR), bail out early.
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  // Try to find existing root; if absent create it synchronously and append to body.
  let portalRoot = document.getElementById("drawer-root");
  if (!portalRoot) {
    portalRoot = document.createElement("div");
    portalRoot.id = "drawer-root";
    document.body.appendChild(portalRoot);
  }

  // If drawer is closed or no project selected, don't render anything
  if (!open || !project) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-end"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className="relative ml-auto w-full max-w-[1100px] h-[92%] max-h-[820px] bg-white rounded-l-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (fixed) */}
        <div className="shrink-0 px-6 py-4 border-b flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">{project.name}</h3>
            <p className="text-sm text-muted-foreground">{project.description}</p>
          </div>
          <div>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Form */}
            {isAdmin && (
              <div className="space-y-4 border-r pr-4">
                <h4 className="font-semibold">Assign New Task</h4>

                <div>
                  <Label>Title</Label>
                  <Input
                    name="title"
                    value={taskForm.title}
                    onChange={handleChange}
                    placeholder="Task title"
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    name="description"
                    value={taskForm.description}
                    onChange={handleChange}
                    placeholder="Short description"
                  />
                </div>

                <div>
                  <Label>Due date</Label>
                  <Input
                    type="date"
                    name="dueDate"
                    value={taskForm.dueDate}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <Label>Assign to</Label>
                  <Select
                    onValueChange={(v) =>
                      setTaskForm((p) => ({ ...p, assignedTo: v }))
                    }
                    value={taskForm.assignedTo}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id.toString()}>
                          {e.name} — {e.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Button
                    className="w-full"
                    onClick={handleAddTask}
                    disabled={loading}
                  >
                    {loading ? "Creating..." : "Create & Assign"}
                  </Button>
                </div>
              </div>
            )}

            {/* Right: Task list */}
            <div className="flex flex-col">
              <h4 className="font-semibold mb-3">Project Tasks</h4>
              <div className="flex-1 space-y-3">
                {tasks.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No tasks yet.</div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="border rounded-lg p-4 flex flex-col bg-white"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium">{task.title}</h5>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${task.status === "completed" ? "bg-green-100 text-green-700" : task.status === "in_progress" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700"
                                }`}
                            >
                              {task.status}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            {task.description || "No description"}
                          </p>
                        </div>

                        <div className="text-right text-xs">
                          <div>Assigned to</div>
                          <div className="font-medium">
                            {task.assignedTo?.name || "—"}
                          </div>
                          <div className="text-muted-foreground mt-2">
                            Due:{" "}
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString()
                              : "—"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {task.status !== "completed" && (
                          <Button size="sm" onClick={() => markComplete(task.id)}>
                            Mark Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigator.clipboard?.writeText(task.title)}
                        >
                          Copy Title
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer (fixed) */}
        <div className="shrink-0 px-6 py-3 border-t flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>,
    portalRoot || document.body
  );
}
