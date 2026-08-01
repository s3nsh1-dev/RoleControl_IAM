import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi } from '@/api/services'
import { ThemeToggle } from '@/components/ThemeToggle'
import { queryKeys } from '@/constants'
import { AuthCredentialsForm, AuthMarketingCopy } from '@/features/auth'
import { useAuthStore } from '@/store/auth'
import {
  loginSchema,
  registerSchema,
  type LoginFormValues,
  type RegisterFormValues,
} from '@/validation/schemas'

export function AuthPage({ mode = 'login' }: { mode?: 'login' | 'register' }) {
  const [activeMode, setActiveMode] = useState(mode)
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  })
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullname: '', email: '', password: '' },
    mode: 'onBlur',
  })

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async () => {
      setAuthenticated()
      await queryClient.fetchQuery({
        queryKey: queryKeys.authMe,
        queryFn: authApi.me,
      })
      toast.success('Signed in')
      navigate('/dashboard', { replace: true })
    },
    onError: (error) => toast.error(error.message),
  })

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      toast.success('Bootstrap account created. Sign in to continue.')
      registerForm.reset()
      setActiveMode('login')
    },
    onError: (error) => toast.error(error.message),
  })

  const isPending = loginMutation.isPending || registerMutation.isPending

  return (
    <main className="auth-screen">
      <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 10 }}>
        <ThemeToggle />
      </div>
      <section className="auth-panel">
        <AuthMarketingCopy />
        <AuthCredentialsForm
          activeMode={activeMode}
          setActiveMode={setActiveMode}
          loginForm={loginForm}
          registerForm={registerForm}
          isPending={isPending}
          onLogin={(data) => loginMutation.mutate(data)}
          onRegister={(data) => registerMutation.mutate(data)}
        />
      </section>
    </main>
  )
}
