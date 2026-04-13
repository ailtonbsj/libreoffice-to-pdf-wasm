import { VercelRequest, VercelResponse } from "@vercel/node";
import path from 'node:path';
import fs from "fs";
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { file = '' } = req.query;
    const fileSafe = (typeof file === 'string' ? file : file[0]).replace('..','');
    if(fileSafe != '') {
        try {
            const filePath = path.join('/tmp', fileSafe);
            const fileBuffer = fs.readFileSync(filePath);
            res.send(fileBuffer);
        } catch (error) {
            console.error(error);
            const {stdout, stderr} = await execAsync('cat /etc/os-release');
            console.log(stdout, stderr);
        }
    } else res.status(400).send('Bad request');
}