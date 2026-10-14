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
from django.urls import path, include, re_path

from modules.core import views as core_views

urlpatterns = [
    # Django admin (superusers / staff)
    path('admin/', admin.site.urls),

    # Core landing page (redirects to login)
    path('', include('modules.core.urls')),

    # Authentication
    path('auth/', include(('modules.authentication.urls', 'authentication'), namespace='auth')),

    # Other modules
    path('profiles/', include('modules.profiles.urls')),
    path('dashboard/', include('modules.dashboard.urls')),
    path('settings/', include('modules.settings_app.urls')),
    path('notifications/', include(("modules.notifications.urls", "notifications"), namespace="notifications")),
    path('help/', include('modules.help_app.urls')),
    path('session/', include('modules.session.urls')),
    path("chat/", include("modules.chat.urls")),

]

# Uploaded files and snapshots live on local disk; serve them in every
# environment (static() alone only works with DEBUG=True).
urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", core_views.media, name="media"),
]
