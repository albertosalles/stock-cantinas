import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            return NextResponse.json(
                { error: 'Contraseña de administrador no configurada en el servidor' },
                { status: 500 }
            );
        }

        if (password === adminPassword) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { error: 'Contraseña incorrecta' },
                { status: 401 }
            );
        }
    } catch {
        return NextResponse.json(
            { error: 'Error en la solicitud' },
            { status: 400 }
        );
    }
}
