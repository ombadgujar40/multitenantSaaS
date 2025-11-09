import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Users } from "lucide-react"

export default function ProjectModalAlt({
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
  const [teamMembers, setTeamMembers] = useState(0)

  // --- Load employees from parent prop (dt) ---
  useEffect(() => {
    if (dt) setEmployees(dt);
  }, [dt]);

  // --- Fetch tasks for this project ---
  useEffect(() => {
    const fetchTasks = async () => {
      if (!project) return;
      try {
        const res = await axios.get(
          `http://127.0.0.1:2000/task/getProjectTasks/${project.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const uniqueIds = [...new Set(res.data.map(task => task.assignedTo?.id))];
        // console.log(uniqueIds.length);
        setTeamMembers(uniqueIds.length)

        setTasks(res.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Unable to load tasks");
      }
    };
    fetchTasks();
  }, [project, token]);


  // --- Handle input changes ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setTaskForm((prev) => ({ ...prev, [name]: value }));
  };

  // --- Add new task ---
  const handleAddTask = async () => {
    if (!taskForm.title || !taskForm.assignedTo)
      return toast.error("Task title and assigned employee are required");

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

      toast.success("Task created successfully!");

      // reset form
      setTaskForm({ title: "", description: "", dueDate: "", assignedTo: "" });

      // refresh tasks
      const res = await axios.get(
        `http://127.0.0.1:2000/task/getProjectTasks/${project.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTasks(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  if (!project || !open) return null;

  return (
    <div className="w-[90vw] h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col p-6">
      {/* Header */}
      <div className="border-b pb-3">
        <h2 className="text-2xl font-bold text-primary">{project.org.name}</h2>
        <h2 className="text-xl font-bold text-purple-600">{project.name}</h2>

        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>{teamMembers} members</span>
        </div>
        <p className="text-muted-foreground">
          {project.description || "Manage and assign tasks for this project."}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 overflow-hidden">
        {/* ---------- Left Panel: Task Creation Form ---------- */}
        <div className="bg-muted/30 rounded-xl p-5 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Create New Task</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Task Title *
              </label>
              <input
                type="text"
                name="title"
                placeholder="Enter task title"
                value={taskForm.title}
                onChange={handleChange}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                rows="3"
                name="description"
                placeholder="Enter task details"
                value={taskForm.description}
                onChange={handleChange}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-primary/30"
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <input
                type="date"
                name="dueDate"
                value={taskForm.dueDate}
                onChange={handleChange}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Assign To *
              </label>
              <select
                name="assignedTo"
                value={taskForm.assignedTo}
                onChange={handleChange}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-primary/30"
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAddTask}
              disabled={loading}
              className={`w-full mt-3 bg-primary text-white py-2 rounded-md text-sm font-medium hover:bg-primary/90 ${loading ? "opacity-70 cursor-not-allowed" : ""
                }`}
            >
              {loading ? "Adding Task..." : "Add Task"}
            </button>
          </div>
        </div>

        {/* ---------- Right Panel: Task List ---------- */}
        <div className="bg-muted/30 rounded-xl p-5 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Project Tasks</h3>

          {/* Task Items */}
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tasks assigned yet.
              </p>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-base">{task.title}</h4>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${task.status === "completed"
                        ? "bg-green-100 text-green-600"
                        : task.status === "in_progress"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-600"
                        }`}
                    >
                      {task.status}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mt-1">
                    {task.description || "No description provided."}
                  </p>

                  <div className="text-xs text-muted-foreground mt-3 flex justify-between">
                    <span>
                      Assigned to: {task.assignedTo?.name || "Unassigned"}
                    </span>
                    <span>
                      Due:{" "}
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t pt-3 mt-4 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
        >
          Close
        </button>
      </div>
    </div>
  );
}
