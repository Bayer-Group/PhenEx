### Environment Configuration

The application uses environment variables for configuration. Update `/app/ui/.env.local`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Backend Configuration (keeping existing for compatibility)
VITE_BACKEND_URL=http://localhost:8001
```
