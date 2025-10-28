from django.urls import path
from . import views

urlpatterns = [
    # Teacher-side
    path('', views.session_list, name='session_list'),
    path('create/', views.create_session, name='create_session'),
    path('<uuid:session_id>/', views.whiteboard_view, name='whiteboard'),

    # Student-side
    path('join/', views.join_session, name='join_session'),
    path('<uuid:session_id>/student/', views.student_whiteboard_view, name='student_whiteboard'),

    # Utility endpoints
    path('export/<uuid:session_id>/', views.export_session, name='export_session'),
    path('delete/<uuid:session_id>/', views.delete_session, name='delete_session'),
    path('save_snapshot/<uuid:session_id>/', views.save_snapshot, name='save_snapshot'),
    path('qr/<uuid:session_id>/', views.session_qr, name='session_qr'),
    path('upload/<uuid:session_id>/', views.upload_attachment, name='upload_attachment'),
    path('export_pdf/<uuid:session_id>/', views.export_session_pdf, name='export_session_pdf'),
    path('duplicate/<uuid:session_id>/', views.duplicate_session, name='duplicate_session'),

    path('<int:user_id>/toggle_draw/', views.toggle_draw_permission, name='toggle_draw'),

]
