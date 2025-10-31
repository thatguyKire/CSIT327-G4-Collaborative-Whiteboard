from django.shortcuts import redirect

def home(request):
    # Redirect base domain to the login page
    return redirect("auth:login")
