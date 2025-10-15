from django.urls import path
from . import views

urlpatterns = [
    path('', views.session_list, name='session_list'),
    path('create/', views.create_session, name='create_session'),
    path('join/', views.join_session, name='join_session'),
    path('<uuid:session_id>/', views.whiteboard_view, name='whiteboard'),
    path('export/<uuid:session_id>/', views.export_session, name='export_session'),
    path('delete/<uuid:session_id>/', views.delete_session, name='delete_session'),
    path('save_snapshot/<uuid:session_id>/', views.save_snapshot, name='save_snapshot'),

    # new helper endpoints
    path('qr/<uuid:session_id>/', views.session_qr, name='session_qr'),
    path('upload/<uuid:session_id>/', views.upload_attachment, name='upload_attachment'),
    path('export_pdf/<uuid:session_id>/', views.export_session_pdf, name='export_session_pdf'),
    path('duplicate/<uuid:session_id>/', views.duplicate_session, name='duplicate_session'),
    # ...add scheduling/notifications later...
]
