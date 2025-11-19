import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

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
  const [isDeliverableOpen, setIsDeliverableOpen] = useState(false)
  const [deliverableLink, setDeliverableLink] = useState()

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

  const handleSubmitDeliverable = async () => {
    const tok = token || localStorage.getItem('token')
    try {
      const res = await axios.put(
        `http://127.0.0.1:2000/project/update/${project.id}`,
        { link: deliverableLink },
        { headers: { Authorization: `Bearer ${tok}` } }
      );
      try {
        const res = await axios.get("http://127.0.0.1:2000/project/getAllProjects", {
          headers: { Authorization: `Bearer ${tok}` }, params: { role: "admin" }
        });
        setProjects(res.data || []);
      } catch (error) {
        console.error(error);
        toast.error("Failed to fetch projects");
      }
      toast.success("Project updated successfully!");


    } catch (error) {
      console.error(error);
      toast.error("Action failed! Check console for details.");
    }
  }

  // --- Handle input changes ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setTaskForm((prev) => ({ ...prev, [name]: value }));
  };

  // --- Add new task ---
  // replace existing handleAddTask with this
  const handleAddTask = async () => {
    if (!taskForm.title || !taskForm.assignedTo)
      return toast.error("Task title and assigned employee are required");

    setLoading(true);
    const tok = token || localStorage.getItem("token");

    try {
      // 1) create the task
      await axios.post(
        `http://127.0.0.1:2000/task/register`,
        {
          projectId: project.id,
          title: taskForm.title,
          description: taskForm.description,
          dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
          assignedToId: parseInt(taskForm.assignedTo),
          status: "pending",
        },
        { headers: { Authorization: `Bearer ${tok}` } }
      );

      toast.success("Task created successfully!");

      // 2) find chat group associated with this project
      try {
        const groupsRes = await axios.get(`http://127.0.0.1:2000/chat/groups`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        const groupsData = Array.isArray(groupsRes.data) ? groupsRes.data : groupsRes.data.groups || [];

        // find group with matching projectId
        const targetGroup = groupsData.find((g) => Number(g.projectId) === Number(project.id));

        if (targetGroup) {
          // 3) add the assigned employee as a group member
          await axios.post(
            `http://127.0.0.1:2000/chat/groups/${targetGroup.id}/members`,
            { employeeId: Number(taskForm.assignedTo), role: "member" },
            { headers: { Authorization: `Bearer ${tok}` } }
          );
          toast.success("Assigned employee added to chat group.");
        } else {
          // Optionally create the group automatically (if desired). For now just warn.
          console.warn("No chat group found for project", project.id);
          // Optionally create group:
          // await axios.post(`http://127.0.0.1:2000/chat/groups`, {
          //   projectId: project.id, name: project.name, orgId: project.orgId, members: [{ employeeId: Number(taskForm.assignedTo) }]
          // }, { headers: { Authorization: `Bearer ${tok}` } });
        }
      } catch (err) {
        console.error("Failed to add employee to group", err);
        toast.error("Task created but failed to add employee to chat group.");
      }

      // 4) reset form and refresh tasks
      setTaskForm({ title: "", description: "", dueDate: "", assignedTo: "" });

      try {
        const res = await axios.get(
          `http://127.0.0.1:2000/task/getProjectTasks/${project.id}`,
          { headers: { Authorization: `Bearer ${tok}` } }
        );
        setTasks(res.data || []);
        // recalc members count
        const uniqueIds = [...new Set((res.data || []).map(task => task.assignedTo?.id).filter(Boolean))];
        setTeamMembers(uniqueIds.length);
      } catch (err) {
        console.error("Failed to refresh tasks", err);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  if (!project || !open) return null;

  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === "completed").length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);
  return (
    <div className="w-[90vw] h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col p-6">
      {/* Header */}
      <div className="border-b pb-3 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-primary">{project.org.name}</h2>
            <div className="flex items-end justify-start gap-4">
              <h2 className="text-xl font-bold text-accent">{project.name}</h2>
              <h2 className="text-md text-muted">{project.customer.name}</h2>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{teamMembers} members</span>
            </div>
            <p className="text-muted-foreground">
              {project.description || "Manage and assign tasks for this project."}
            </p>
          </div>

          {/* Deliverable Button */}
          {!project.deliverableLink ? (<Button onClick={() => setIsDeliverableOpen(true)}>
            Enter Deliverable Link
          </Button>) : (<a href={`/${project.deliverableLink}`} target="_blank">{project.deliverableLink}</a>)}

        </div>
      </div>

      {/* Deliverable Dialog */}
      <Dialog open={isDeliverableOpen} onOpenChange={setIsDeliverableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Deliverable</DialogTitle>
            <DialogDescription>
              Paste your GitHub repository or hosted link below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="text-sm font-medium">GitHub / Project Link</label>
            <input
              type="url"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://github.com/username/repo"
              value={deliverableLink}
              onChange={(e) => setDeliverableLink(e.target.value)}
            />
          </div>

          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsDeliverableOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitDeliverable}
              disabled={!deliverableLink}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
                    {emp.name} ({emp.jobPosition})
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
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-primary">Project Progress</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progress < 40
                  ? "bg-red-500"
                  : progress < 80
                    ? "bg-yellow-500"
                    : "bg-green-500"
                  }`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
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
