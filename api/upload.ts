import os from "os";
import formidable from "formidable";
import { VercelRequest, VercelResponse } from "@vercel/node";
import { put } from "@vercel/blob";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // required for multipart
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const uploadDir = os.tmpdir();

  const form = formidable({
    multiples: false,
    uploadDir,
    keepExtensions: true,
  });

  try {
    const [fields, files] = await form.parse(req);
    const file = files.file; // name="file" in form
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
  
    const fileUrl = file[0].filepath;
    console.log('Uploaded file: ', fileUrl);
    const filename = fileUrl.split('/').at(-1) ?? '';

    const fileBuffer = fs.readFileSync(fileUrl);
    const { url } = await put(filename, fileBuffer.toString('base64'), { access: 'public' });
    res.redirect(302, `/?file=${url}`);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Upload failed" });
  }

}
