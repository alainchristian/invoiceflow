import { useEffect, useState } from "react";
import api from "../api";

const MAX_LOGO_DIMENSION = 300;

// Re-encodes the uploaded logo through a canvas rather than storing the raw
// file bytes. This guarantees whatever we send to the backend is a
// well-formed image the browser itself successfully decoded (a corrupt or
// unusual file simply fails to load here, with a clear error), and it caps
// the size so a giant photo doesn't get stored as the logo.
function reencodeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a valid image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  const [form, setForm] = useState({
    businessName: "",
    logoUrl: "",
    brandColor: "#4f46e5",
    address: "",
    phone: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await api.get("/settings");
      setForm({
        businessName: data.businessName || "",
        logoUrl: data.logoUrl || "",
        brandColor: data.brandColor || "#4f46e5",
        address: data.address || "",
        phone: data.phone || "",
      });
    }
    load();
  }, []);

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await reencodeImageFile(file);
      setForm({ ...form, logoUrl: dataUrl });
    } catch (err) {
      alert(err.message || "Could not process that image.");
    } finally {
      e.target.value = "";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await api.put("/settings", form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Business profile</h1>
      <p className="mb-6 max-w-lg text-sm text-gray-500">
        This information appears on every PDF invoice and the client-facing invoice
        page you share with your clients.
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex max-w-lg flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Business name</label>
          <input
            type="text"
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Logo</label>
          <div className="flex items-center gap-3">
            {form.logoUrl && (
              <img src={form.logoUrl} alt="Logo preview" className="h-12 w-auto rounded border border-gray-200" />
            )}
            <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} className="text-sm" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Brand color</label>
          <input
            type="color"
            value={form.brandColor}
            onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
            className="h-10 w-16 rounded border border-gray-300"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Save
          </button>
          {saved && <span className="text-sm text-green-600">Saved</span>}
        </div>
      </form>
    </div>
  );
}
