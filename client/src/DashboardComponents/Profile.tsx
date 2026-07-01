import { useState, useRef } from "react"
import { useAuthStore } from "../store/useAuthStore"
import { api } from "../lib/api"
import axios from "axios"

const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.04a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
    </svg>
)

const CameraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-205">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
)

const Spinner = () => (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
)

const LockedIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
)

export default function Profile() {
    const { user, updateUser } = useAuthStore()
    const [isEditing, setIsEditing] = useState(false)
    const [name, setName] = useState(user?.name || "")
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null)
    
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    
    const fileInputRef = useRef<HTMLInputElement>(null)

    const getInitials = (name?: string) => {
        if (!name) return "U";
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setAvatarPreview(URL.createObjectURL(file));
            setError(null);
        }
    };

    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const startEditing = () => {
        setName(user?.name || "");
        setAvatarPreview(user?.avatar || null);
        setSelectedFile(null);
        setError(null);
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            let uploadedAvatarUrl = user?.avatar || "";

            if (selectedFile) {
                // Step 1: Request signature from backend
                const signatureRes = await api.get("/auth/cloudinary-signature");
                const { signature, timestamp, folder, cloudName, apiKey } = signatureRes.data;

                // Step 2: Upload to Cloudinary directly
                const formData = new FormData();
                formData.append("file", selectedFile);
                formData.append("api_key", apiKey);
                formData.append("timestamp", timestamp.toString());
                formData.append("signature", signature);
                formData.append("folder", folder);

                const uploadRes = await axios.post(
                    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                    formData
                );
                
                uploadedAvatarUrl = uploadRes.data.secure_url;
            }

            // Step 3: Send updated data to backend
            const updateRes = await api.put("/auth/profile", {
                name,
                avatar: uploadedAvatarUrl,
            });

            // Step 4: Update Zustand store
            updateUser(updateRes.data.user);
            
            setSuccess(true);
            setIsEditing(false);
            setSelectedFile(null);
            
            // Clear success after 3 seconds
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            console.error("Error saving profile details:", err);
            setError(
                err.response?.data?.message || 
                err.message || 
                "An unexpected error occurred while saving your profile."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setName(user?.name || "");
        setSelectedFile(null);
        setAvatarPreview(user?.avatar || null);
        setError(null);
    };

    return (
        <div className="w-full">
            {/* Profile Page Layout */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-900 bg-slate-950/40 backdrop-blur-xl shadow-2xl">
                {/* Cover Banner */}
                <div className="h-48 bg-gradient-to-r from-blue-600 to-violet-600 border-b border-slate-900/60 relative">
                    <div className="absolute top-6 right-6 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                        Personal Workspace
                    </div>
                </div>

                {/* Profile details */}
                <div className="px-8 pb-10 relative">
                    {/* Profile Picture */}
                    {!isEditing ? (
                        <div className="-mt-14 mb-6">
                            {avatarPreview ? (
                                <img
                                    src={avatarPreview}
                                    alt={user?.name || "Avatar"}
                                    className="h-28 w-28 rounded-2xl border-2 border-slate-950 bg-slate-900 shadow-xl object-cover shadow-slate-950/50"
                                />
                            ) : (
                                <div className="h-28 w-28 rounded-2xl border-2 border-slate-950 bg-slate-900 shadow-xl shadow-slate-950/50 flex items-center justify-center font-extrabold text-3xl text-indigo-300">
                                    {getInitials(user?.name || user?.email)}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="-mt-14 mb-6 relative inline-block">
                            <div 
                                onClick={triggerFileInput}
                                className="cursor-pointer relative overflow-hidden h-28 w-28 rounded-2xl border-2 border-slate-950 bg-slate-900 shadow-xl shadow-slate-950/50 group"
                                title="Click to change avatar"
                            >
                                {avatarPreview ? (
                                    <img
                                        src={avatarPreview}
                                        alt="Preview"
                                        className="h-28 w-28 object-cover rounded-2xl"
                                    />
                                ) : (
                                    <div className="h-28 w-28 bg-slate-900 flex items-center justify-center font-extrabold text-3xl text-indigo-300">
                                        {getInitials(name || user?.email)}
                                    </div>
                                )}
                                {/* Overlay on hover */}
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <CameraIcon />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200 mt-1">Change</span>
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>
                    )}

                    {/* Form / Details Container */}
                    {!isEditing ? (
                        <div className="space-y-6">
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                    {/* User Name as Heading */}
                                    <h2 className="text-3xl font-extrabold text-white tracking-tight min-h-[2.25rem] truncate max-w-lg">
                                        {user?.name || ""}
                                    </h2>
                                    {/* User Email as Subheading */}
                                    <p className="text-sm text-slate-400 font-medium select-all">
                                        {user?.email}
                                    </p>
                                </div>
                                <button
                                    onClick={startEditing}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-900 hover:border-slate-800 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-850 hover:text-white transition-all shadow-md cursor-pointer"
                                >
                                    <EditIcon />
                                    Edit Profile
                                </button>
                            </div>
                            
                            {success && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                    </svg>
                                    Profile updated successfully!
                                </div>
                            )}

                            {/* Account Verification Details */}
                            <div className="pt-6 border-t border-slate-900/60 flex items-center gap-6 text-xs text-slate-500">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                    <span>Verified Member</span>
                                </div>
                                <div className="h-1 w-1 rounded-full bg-slate-800" />
                                <div>
                                    <span>Role: Owner</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-6">
                            {error && (
                                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex flex-col gap-1">
                                    <div className="font-bold flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-rose-400">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                                        </svg>
                                        Failed to save changes
                                    </div>
                                    <p className="opacity-90">{error}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Name Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Enter your name"
                                        required
                                        className="w-full bg-slate-900/40 border border-slate-900 rounded-xl px-4 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:bg-slate-900/60 transition-all text-slate-200"
                                    />
                                </div>

                                {/* Email Input (Readonly) */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-900 rounded border border-slate-800 text-[10px] text-slate-500 font-bold uppercase tracking-wider select-none">
                                            <LockedIcon />
                                            Read-Only
                                        </div>
                                    </div>
                                    <input
                                        type="email"
                                        value={user?.email || ""}
                                        disabled
                                        className="w-full bg-slate-900/10 border border-slate-900/30 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed select-none"
                                    />
                                    <p className="text-[11px] text-slate-600 font-medium">Email address modification is currently restricted.</p>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="pt-6 border-t border-slate-900/60 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    disabled={loading}
                                    className="px-5 py-2.5 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {loading && <Spinner />}
                                    {loading ? "Saving Changes..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
