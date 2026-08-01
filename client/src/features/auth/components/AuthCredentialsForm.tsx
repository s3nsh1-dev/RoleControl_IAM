import type { UseFormReturn } from 'react-hook-form'
import { Button, Field } from '@/components/ui'
import type { LoginFormValues, RegisterFormValues } from '@/validation/schemas'

type AuthCredentialsFormProps = {
  activeMode: 'login' | 'register'
  setActiveMode: (mode: 'login' | 'register') => void
  loginForm: UseFormReturn<LoginFormValues>
  registerForm: UseFormReturn<RegisterFormValues>
  isPending: boolean
  onLogin: (data: LoginFormValues) => void
  onRegister: (data: RegisterFormValues) => void
}

export function AuthCredentialsForm({
  activeMode,
  setActiveMode,
  loginForm,
  registerForm,
  isPending,
  onLogin,
  onRegister,
}: AuthCredentialsFormProps) {
  const isRegister = activeMode === 'register'
  const emailRegistration = isRegister
    ? registerForm.register('email')
    : loginForm.register('email')
  const passwordRegistration = isRegister
    ? registerForm.register('password')
    : loginForm.register('password')
  const emailError = isRegister
    ? registerForm.formState.errors.email?.message
    : loginForm.formState.errors.email?.message
  const passwordError = isRegister
    ? registerForm.formState.errors.password?.message
    : loginForm.formState.errors.password?.message

  return (
    <form
      className="auth-card"
      onSubmit={
        isRegister
          ? registerForm.handleSubmit(onRegister)
          : loginForm.handleSubmit(onLogin)
      }
    >
      <div className="segmented">
        <button
          type="button"
          className={!isRegister ? 'active' : ''}
          onClick={() => setActiveMode('login')}
        >
          Login
        </button>
        <button
          type="button"
          className={isRegister ? 'active' : ''}
          onClick={() => setActiveMode('register')}
        >
          Bootstrap
        </button>
      </div>

      {isRegister ? (
        <Field
          label="Full name"
          error={registerForm.formState.errors.fullname?.message}
          {...registerForm.register('fullname')}
        />
      ) : null}
      <Field
        label="Email"
        type="email"
        error={emailError}
        {...emailRegistration}
      />
      <Field
        label="Password"
        type="password"
        error={passwordError}
        {...passwordRegistration}
      />

      <Button variant="primary" disabled={isPending} type="submit">
        {isRegister ? 'Create first super-admin' : 'Sign in'}
      </Button>
      <p className="form-note">
        Local HTTP may need a backend dev-only cookie setting because the
        backend currently marks cookies as secure.
      </p>
    </form>
  )
}
