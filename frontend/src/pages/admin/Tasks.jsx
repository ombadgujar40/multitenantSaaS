// import { useEffect, useState } from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
//   DialogDescription,
// } from "@/components/ui/dialog";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   CheckSquare,
//   Calendar,
//   User,
//   Pencil,
//   Trash2,
//   Plus,
// } from "lucide-react";
// import { toast } from "sonner";
// import axios from "axios";
// import { empAuth } from "../../contexts/EmpContext";
// import { custAuth } from "../../contexts/CustContext";

// export default function Tasks() {
//   const { token, org, data } = empAuth() || custAuth();

//   const [tasks, setTasks] = useState([]);
//   const [selectedTask, setSelectedTask] = useState(null);
//   const [isOpen, setIsOpen] = useState(false);
//   const [isEditMode, setIsEditMode] = useState(false);

//   // -------- Fetch Tasks ----------
//   useEffect(() => {
//     const tok = token || localStorage.getItem("token");
//     const fetchTasks = async () => {
//       try {
//         const res = await axios.get("http://127.0.0.1:2000/task/getAllTasks", {
//           headers: { Authorization: `Bearer ${tok}`}, params: {role: "admin"}
//         });
//         console.log(res.data)
//         setTasks(res.data || []);
//       } catch (error) {
//         console.error(error);
//         toast.error("Failed to fetch tasks");
//       }
//     };
//     if (tok) fetchTasks();
//   }, [token, org]);

//   // -------- Handlers ----------
//   const handleAdd = () => {
//     setSelectedTask({
//       title: "",
//       assignee: "",
//       dueDate: "",
//       status: "pending",
//     });
//     setIsEditMode(false);
//     setIsOpen(true);
//   };

//   const handleEdit = (task) => {
//     setSelectedTask(task);
//     setIsEditMode(true);
//     setIsOpen(true);
//   };

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setSelectedTask((prev) => ({ ...prev, [name]: value }));
//   };

//   // -------- Save (Add / Update) ----------
//   const handleSave = async () => {
//     try {
//       if (isEditMode) {
//         const res = await axios.put(
//           `http://127.0.0.1:2000/task/update/${selectedTask.id}`,
//           selectedTask,
//           { headers: { Authorization: `Bearer ${token}` } }
//         );

//         setTasks((prev) =>
//           prev.map((t) =>
//             t.id === selectedTask.id ? { ...t, ...res.data.task } : t
//           )
//         );
//         toast.success("Task updated successfully!");
//       } else {
//         const payload = { ...selectedTask, orgName: org };

//         const res = await axios.post(`http://127.0.0.1:2000/task/create`, payload, {
//           headers: { Authorization: `Bearer ${token}` },
//         });

//         setTasks((prev) => [...prev, res.data.task]);
//         toast.success("Task added successfully!");
//       }

//       setIsOpen(false);
//     } catch (error) {
//       console.error(error);
//       toast.error("Action failed! Check console for details.");
//     }
//   };

//   // -------- Delete ----------
//   const handleDelete = async (id) => {
//     const confirmation = confirm("Do you want to delete this task?");
//     if (!confirmation) return;

//     try {
//       await axios.delete(`http://127.0.0.1:2000/task/delete/${id}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       setTasks((prev) => prev.filter((t) => t.id !== id));
//       toast.success("Task deleted successfully!");
//     } catch (error) {
//       console.error(error);
//       toast.error("Failed to delete task");
//     }
//   };

//   // -------- UI ----------
//   const statusColors = {
//     completed: "bg-green-500 text-white",
//     "in-progress": "bg-primary text-primary-foreground",
//     pending: "bg-yellow-500 text-black",
//   };

//   return (
//     <div className="space-y-8 animate-fade-in">
//       <div className="flex justify-between items-center">
//         <div>
//           <h1 className="text-4xl font-bold mb-2">Tasks</h1>
//           <p className="text-muted-foreground">
//             Manage and track all ongoing organization tasks
//           </p>
//         </div>
//         <Button onClick={handleAdd} className="flex items-center gap-2">
//           <Plus className="h-5 w-5" /> Add Task
//         </Button>
//       </div>

//       {/* Task Cards */}
//       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
//         {tasks.map((task) => (
//           <Card
//             key={task.id}
//             className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
//           >
//             <CardHeader>
//               <div className="flex items-start justify-between">
//                 <div className="p-2 rounded-lg bg-primary/10">
//                   <CheckSquare className="h-6 w-6 text-primary" />
//                 </div>
//                 <Badge className={statusColors[task.status]}>
//                   {task.status}
//                 </Badge>
//               </div>
//               <CardTitle className="mt-4">{task.title}</CardTitle>
//             </CardHeader>

//             <CardContent className="space-y-4 text-sm text-muted-foreground">
//               <div className="flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <User className="h-4 w-4" />
//                   <span>{task.assignee || "Unassigned"}</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <Calendar className="h-4 w-4" />
//                   <span>
//                     {task.dueDate
//                       ? new Date(task.dueDate).toLocaleDateString()
//                       : "No due date"}
//                   </span>
//                 </div>
//               </div>

//               {/* Buttons */}
//               <div className="flex justify-end gap-2">
//                 <Button
//                   size="sm"
//                   variant="outline"
//                   onClick={() => handleEdit(task)}
//                   className="flex items-center gap-1"
//                 >
//                   <Pencil className="h-4 w-4" /> Edit
//                 </Button>
//                 <Button
//                   size="sm"
//                   variant="destructive"
//                   onClick={() => handleDelete(task.id)}
//                   className="flex items-center gap-1"
//                 >
//                   <Trash2 className="h-4 w-4" /> Delete
//                 </Button>
//               </div>
//             </CardContent>
//           </Card>
//         ))}
//       </div>

//       {/* Dialog for Add/Edit */}
//       <Dialog open={isOpen} onOpenChange={setIsOpen}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>
//               {isEditMode ? "Edit Task" : "Add Task"}
//             </DialogTitle>
//             <DialogDescription>
//               {isEditMode
//                 ? "Update the details of this task."
//                 : "Create a new task for your organization."}
//             </DialogDescription>
//           </DialogHeader>

//           <div className="space-y-4">
//             <div>
//               <Label>Title</Label>
//               <Input
//                 name="title"
//                 value={selectedTask?.title || ""}
//                 onChange={handleChange}
//               />
//             </div>
//             <div>
//               <Label>Assignee</Label>
//               <Input
//                 name="assignee"
//                 value={selectedTask?.assignee || ""}
//                 onChange={handleChange}
//               />
//             </div>
//             <div>
//               <Label>Due Date</Label>
//               <Input
//                 type="date"
//                 name="dueDate"
//                 value={selectedTask?.dueDate || ""}
//                 onChange={handleChange}
//               />
//             </div>
//             <div>
//               <Label>Status</Label>
//               <Input
//                 name="status"
//                 value={selectedTask?.status || ""}
//                 onChange={handleChange}
//               />
//             </div>
//           </div>

//           <DialogFooter>
//             <Button onClick={handleSave}>
//               {isEditMode ? "Update Task" : "Add Task"}
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }
