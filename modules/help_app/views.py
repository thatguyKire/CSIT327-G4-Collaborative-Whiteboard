from django.shortcuts import render
from django.contrib.auth.decorators import login_required

@login_required
def help_view(request):
    return render(request, "help_app/help.html")
