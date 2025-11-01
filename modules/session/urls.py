from django.urls import path
from .views import (
    session_list,
    create_session,
    join_session,
    whiteboard_view,
    student_whiteboard_view,
    export_session,
    delete_session,
    save_snapshot,
    session_qr,
    export_session_pdf,
    duplicate_session,
    toggle_draw_permission,
    chat_messages,
    send_message,
    offline_view,
    upload_views,
)

urlpatterns = [
    # Teacher-side
    path('', session_list, name='session_list'),
    path('create/', create_session, name='create_session'),
    path('<uuid:session_id>/', whiteboard_view, name='whiteboard'),

    # Student-side
    path('join/', join_session, name='join_session'),
    path('<uuid:session_id>/student/', student_whiteboard_view, name='student_whiteboard'),

    # Utility endpoints
    path('export/<uuid:session_id>/', export_session, name='export_session'),
    path('delete/<uuid:session_id>/', delete_session, name='delete_session'),
    path('save_snapshot/<uuid:session_id>/', save_snapshot, name='save_snapshot'),
    path('qr/<uuid:session_id>/', session_qr, name='session_qr'),
    path('export_pdf/<uuid:session_id>/', export_session_pdf, name='export_session_pdf'),
    path('duplicate/<uuid:session_id>/', duplicate_session, name='duplicate_session'),

    # Teacher permission toggle
    path('<int:user_id>/toggle_draw/', toggle_draw_permission, name='toggle_draw'),

    # Chat endpoints
    path('<uuid:session_id>/chat/', chat_messages, name='chat_messages'),
    path('<uuid:session_id>/chat/send/', send_message, name='send_message'),

    # Offline view
    path('<uuid:session_id>/offline/', offline_view, name='offline_view'),

    # ✅ Upload
    path('<uuid:session_id>/upload/', upload_views.upload_attachment, name='upload_attachment'),
]
