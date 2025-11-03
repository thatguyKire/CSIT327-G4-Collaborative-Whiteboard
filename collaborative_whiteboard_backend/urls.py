"""
URL configuration for collaborative_whiteboard_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Core landing page (redirects to login)
    path('', include('modules.core.urls')),

    # Authentication
    path('auth/', include(('modules.authentication.urls', 'authentication'), namespace='auth')),

    # Other modules
    path('profiles/', include('modules.profiles.urls')),
    path('dashboard/', include('modules.dashboard.urls')),
    path('settings/', include('modules.settings_app.urls')),
    path('notifications/', include('modules.notifications.urls')),
    path('help/', include('modules.help_app.urls')),
    path('session/', include('modules.session.urls')),
    path("chat/", include("modules.chat.urls")),

]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)