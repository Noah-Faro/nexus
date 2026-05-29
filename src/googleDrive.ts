// src/googleDrive.ts
export async function findStateFileId(token: string): Promise<{ id: string, modifiedTime: string } | null> {
  const q = encodeURIComponent("name='state.nexus' and 'appDataFolder' in parents");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=appDataFolder&fields=files(id,modifiedTime)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to find state file: ${await res.text()}`);
  }
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

export async function uploadStateToDrive(token: string, fileId: string | null, encryptedData: string) {
  const url = fileId 
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  
  const headers: HeadersInit = { Authorization: `Bearer ${token}` };
  let body: any = encryptedData;
  
  if (!fileId) {
    // Multipart upload to specify file name and parent folder
    const metadata = JSON.stringify({ name: 'state.nexus', parents: ['appDataFolder'] });
    const boundary = 'nexus_boundary';
    headers['Content-Type'] = `multipart/related; boundary=${boundary}`;
    
    body = `--${boundary}\r\n` +
           `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
           `${metadata}\r\n` +
           `--${boundary}\r\n` +
           `Content-Type: application/octet-stream\r\n\r\n` +
           `${encryptedData}\r\n` +
           `--${boundary}--`;
  } else {
    headers['Content-Type'] = 'application/octet-stream';
  }

  const res = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers,
    body
  });
  if (!res.ok) {
    throw new Error(`Failed to upload state: ${await res.text()}`);
  }
  return res.json();
}

export async function downloadStateFromDrive(token: string, fileId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&spaces=appDataFolder`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to download state: ${await res.text()}`);
  }
  return res.text();
}
