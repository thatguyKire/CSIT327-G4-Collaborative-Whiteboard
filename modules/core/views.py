from django.shortcuts import redirect
from django.contrib.auth.forms import AuthenticationForm

def landing(request):
    # Redirect root to the login page
    return redirect("auth:login")

def home(request):
    # Legacy path → also go to login
    return redirect("auth:login")
