import { VercelRequest, VercelResponse } from "@vercel/node";
import { del } from '@vercel/blob';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const { url = '' } = req.query;
        await del(`${url}`);
        res.status(200).send('Ok.');
    } catch (error) {
        res.status(404).send('Not found.');
    }
}