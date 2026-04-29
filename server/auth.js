import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

export function signAccessToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            username: user.username,
            is_admin: Boolean(user.is_admin)
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

export function verifyAccessToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

export function authRequired(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    try {
        const payload = verifyAccessToken(token);
        req.user = {
            id: payload.sub,
            email: payload.email,
            username: payload.username,
            is_admin: Boolean(payload.is_admin)
        };
        return next();
    } catch (e) {
        return res.status(401).json({ error: 'Недействительный токен' });
    }
}

export function adminRequired(req, res, next) {
    if (!req.user?.is_admin) {
        return res.status(403).json({ error: 'Недостаточно прав' });
    }
    return next();
}
