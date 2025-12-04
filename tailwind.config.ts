export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        elche: {
          primary: '#00964f', // Verde Elche Principal
          secondary: '#007a3d', // Verde Oscuro (Hover)
          accent: '#20b368', // Verde Claro / Brillante
          
          bg: '#f5f9f7', // Fondo App (Verde muy pálido)
          surface: '#ffffff', // Fondo Tarjetas
          
          text: {
            DEFAULT: '#1a2e1f', // Texto Principal (Verde casi negro)
            muted: '#4a5f52', // Texto Secundario (Verde grisáceo)
            light: '#4a5f52', // Alias para compatibilidad
          },
          
          border: '#e8f4ee', // Bordes (Gris verdoso)
          gray: '#e8f4ee', // Alias para compatibilidad
          
          // Estados semánticos
          success: '#00964f',
          warning: '#fbbf24', // Amber-400 (Stock bajo)
          danger: '#ef4444', // Red-500 (Agotado / Error)
        },
      },
    },
  },
  plugins: [],
};
