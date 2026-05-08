const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = 'edumagng_unsigned';

export async function uploadToCloudinary(
  file: File,
  folder: 'students' | 'assignments' | 'schools'
): Promise<{ url: string; public_id: string }> {
  if (!CLOUD_NAME) throw new Error('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `edumagng/${folder}`);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? 'Upload failed');
  }

  const data = await response.json();
  return { url: data.secure_url as string, public_id: data.public_id as string };
}
