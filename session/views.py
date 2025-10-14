from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils.crypto import get_random_string
from .models import Session, Participant

@login_required
def session_list(request):
    session = Session.objects.filter(created_by=request.user)
    return render(request, 'session/session_list.html', {'sessions': session})

@login_required
def create_session(request):
    if request.method == 'POST':
        title = request.POST.get('title')
        code = get_random_string(6).upper()
        session = Session.objects.create(title=title, created_by=request.user, code=code)
        return redirect('whiteboard', session_id=session.id)
    return render(request, 'session/session_list.html')

@login_required
def join_session(request):
    if request.method == 'POST':
        code = request.POST.get('code')
        session = Session.objects.filter(code=code).first()
        if session:
            Participant.objects.get_or_create(user=request.user, session=session)
            return redirect('whiteboard', session_id=session.id)
        else:
            return render(request, 'session/join_session.html', {'error': 'Invalid session code'})
    return render(request, 'session/join_session.html')

@login_required
def whiteboard_view(request, session_id):
    session = get_object_or_404(Session, id=session_id)
    return render(request, 'session/whiteboard.html', {'session': session})

@login_required
def export_session(request, session_id):
    session = get_object_or_404(Session, id=session_id)
    return render(request, 'session/export_success.html', {'session': session})
