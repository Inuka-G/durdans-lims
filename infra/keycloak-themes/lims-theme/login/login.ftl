<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Durdans Laboratory Management System</title>

    <script src="https://cdn.tailwindcss.com?plugins=forms,typography"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet" />

    <style>
        body { font-family: 'Inter', sans-serif; }
        .brand-gradient {
            background: linear-gradient(135deg, #005696 0%, #00a99d 100%);
        }
        .pattern-overlay {
            background-image: radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px);
            background-size: 20px 20px;
        }
        .login-card {
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05), 0 1px 8px rgba(0, 0, 0, 0.02);
        }
        .input-group:focus-within .input-icon {
            color: #005696;
        }
        .custom-checkbox:checked {
            background-color: #005696;
            border-color: #005696;
        }
    </style>
</head>

<body class="bg-gray-50 min-h-screen overflow-x-hidden">

<div class="flex flex-col md:flex-row min-h-screen">

    <!-- LEFT SIDE: Branding & Background -->
    <div class="hidden md:flex md:w-5/12 brand-gradient flex-col justify-between p-10 lg:p-16 text-white relative">
        <div class="absolute inset-0 pattern-overlay opacity-30"></div>
        
        <div class="relative z-10 space-y-10">
            <!-- Large Logo Box -->
            <div class="bg-white p-5 rounded-xl inline-block shadow-lg w-32 h-32 flex items-center justify-center">
                <img src="https://durdans.blob.core.windows.net/bot/durdans.jpg" alt="Durdans Hospital" class="max-w-full h-auto" />
            </div>

            <div class="space-y-5">
                <h1 class="text-3xl lg:text-4xl font-bold leading-tight">
                    World-class Healthcare,<br/>Simplified.
                </h1>
                <p class="text-base lg:text-lg text-blue-50/80 max-w-lg font-light leading-relaxed">
                    Access the Laboratory Management System to manage patient records, lab results, and diagnostics with precision and security.
                </p>
            </div>
        </div>

        <div class="relative z-10 text-sm font-light text-blue-50/60 flex flex-wrap gap-4">
            <span>&copy; 2024 Durdans Hospital</span>
            <span class="opacity-30">•</span>
            <a href="#" class="hover:text-white transition-colors">Privacy Policy</a>
            <span class="opacity-30">•</span>
            <a href="#" class="hover:text-white transition-colors">Support</a>
        </div>
    </div>

    <!-- RIGHT SIDE: Login Form -->
    <div class="w-full md:w-7/12 flex items-center justify-center p-6 lg:p-12">
        
        <div class="w-full max-w-md space-y-6">
            
            <div class="login-card p-8 md:p-10 space-y-6 relative">
                
                <!-- Small Logo for Mobile/Small views inside card -->
                <div class="text-center space-y-4">
                    <img src="https://durdans.blob.core.windows.net/bot/durdans.jpg" alt="Logo" class="h-16 mx-auto" />
                    
                    <div class="space-y-1">
                        <h2 class="text-xl font-bold text-gray-800 tracking-tight">
                            Laboratory Management System
                        </h2>
                        <p class="text-xs text-gray-500">
                            Secure login for authorized staff
                        </p>
                    </div>
                </div>

                <#-- 🔥 KEYCLOAK LOGIN FORM -->
                <form id="kc-form-login"
                      action="${url.loginAction}"
                      method="post"
                      class="space-y-6">

                    <#if message?has_content>
                        <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded flex items-start space-x-3">
                            <span class="material-icons-outlined text-red-500 text-sm mt-0.5">error_outline</span>
                            <span class="text-red-700 text-sm font-medium">${message.summary}</span>
                        </div>
                    </#if>

                    <!-- Username Field -->
                    <div class="space-y-2">
                        <label for="username" class="block text-sm font-semibold text-gray-700">
                            Username or Email
                        </label>
                        <div class="relative group input-group">
                            <span class="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg input-icon transition-colors">person_outline</span>
                            <input id="username"
                                   name="username"
                                   type="text"
                                   value="${username!''}"
                                   placeholder="Enter your ID or email"
                                   required
                                   autofocus
                                   class="block w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700 focus:bg-white transition-all text-sm text-gray-900 placeholder:text-gray-400" />
                        </div>
                    </div>

                    <!-- Password Field -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <label for="password" class="block text-sm font-semibold text-gray-700">
                                Password
                            </label>
                            <a href="${url.loginResetCredentialsUrl}" class="text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors">
                                Forgot password?
                            </a>
                        </div>
                        <div class="relative group input-group">
                            <span class="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg input-icon transition-colors pointer-events-none">lock_outline</span>
                            <input id="password"
                                   name="password"
                                   type="password"
                                   placeholder="Enter your password"
                                   required
                                   autocomplete="off"
                                   class="block w-full pl-12 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700 focus:bg-white transition-all text-sm text-gray-900 placeholder:text-gray-400" />
                            <button type="button" tabindex="-1" id="togglePassword" class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none" aria-label="Toggle password visibility">
                                <span class="material-icons-outlined text-lg pointer-events-none">visibility_off</span>
                            </button>
                        </div>
                    </div>

                    <#if realm.rememberMe?? && realm.rememberMe>
                        <div class="flex items-center space-x-3">
                            <input id="rememberMe"
                                   name="rememberMe"
                                   type="checkbox"
                                   class="w-4 h-4 text-blue-700 border-gray-300 rounded custom-checkbox focus:ring-blue-600 focus:ring-offset-0" />
                            <label for="rememberMe" class="text-sm text-gray-600 cursor-pointer">Remember this device</label>
                        </div>
                    </#if>

                    <button type="submit"
                            class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#005696] hover:bg-[#004a82] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-blue-900/10">
                        Sign In to Portal
                    </button>

                </form>

                <div class="pt-5 border-t border-gray-100">
                    <p class="text-center text-[10px] text-gray-400 uppercase tracking-widest leading-relaxed">
                        Protected by enterprise-grade security.<br/>
                        Authorized access only. Unauthorized access is prohibited.
                    </p>
                </div>

            </div>

        </div>

    </div>
</div>

<script>
    // Password visibility toggle - prevent focus theft from password input
    const passInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePassword');
    if (toggleBtn && passInput) {
        toggleBtn.addEventListener('mousedown', function(e) {
            e.preventDefault(); // Prevent the button from stealing focus
        });
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passInput.setAttribute('type', type);
            toggleBtn.querySelector('span').textContent = type === 'password' ? 'visibility_off' : 'visibility';
            passInput.focus(); // Return focus to the password input
        });
    }
</script>

</body>
</html>
