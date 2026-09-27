import { Icon } from "../components/Icon";
import { Toaster } from "sonner";
import loginBridgeBackground from "../assets/login/login-bridge-background.webp";
import loginDroplet from "../assets/login/control-aguas-droplet.png";
import loginSplash from "../assets/login/control-aguas-splash.png";

export default function LoginScreen({ model }) {
  const {
    authFx,
    handleLogin,
    handleLoginChange,
    loginForm,
    loginLoading,
    setShowLoginPassword,
    showLoginPassword
  } = model;

  return (
    <div
      className="login-shell login-scene"
      style={{ "--login-bridge-background": `url(${loginBridgeBackground})` }}
    >
      {authFx ? (
        <div className={`auth-fx auth-fx-${authFx.mode}`}>
          <div className="auth-fx-card">
            <span className="auth-fx-dot" />
            <strong>{authFx.text}</strong>
          </div>
        </div>
      ) : null}
      <Toaster position="top-right" richColors closeButton duration={5000} visibleToasts={3} />
      <div className="login-droplet-sequence" aria-hidden="true">
        <img className="login-droplet-fall" src={loginDroplet} alt="" />
        <img className="login-droplet-splash" src={loginSplash} alt="" />
        <img className="login-droplet-resolve" src={loginDroplet} alt="" />
      </div>
      <div className="login-layout">
        <main className="login-card" aria-labelledby="login-title">
          <header className="login-card-head">
            <img src={loginDroplet} alt="Logo de Control Aguas" className="login-logo" />
            <p className="login-brand-kicker">AGUAS DE CHOLUTECA</p>
            <h1 id="login-title">Control Aguas</h1>
            <p className="login-subtitle">Acceso al sistema de registro y seguimiento.</p>
          </header>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="login-field">
              <label htmlFor="login-username">Usuario o correo</label>
              <div className="login-input-shell">
                <span className="login-input-icon" aria-hidden="true"><Icon name="users" /></span>
                <input
                  id="login-username"
                  name="username"
                  value={loginForm.username}
                  onChange={handleLoginChange}
                  autoComplete="username"
                  placeholder="Ingresa tu usuario o correo"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Contraseña</label>
              <div className="login-input-shell">
                <span className="login-input-icon" aria-hidden="true"><Icon name="auth" /></span>
                <input
                  id="login-password"
                  name="password"
                  type={showLoginPassword ? "text" : "password"}
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowLoginPassword((current) => !current)}
                  aria-label={showLoginPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showLoginPassword}
                >
                  {showLoginPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <button className="login-submit" type="submit" disabled={loginLoading}>
              {loginLoading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <p className="login-footnote">Acceso exclusivo para personal autorizado.</p>
        </main>
      </div>
    </div>
  );
}
