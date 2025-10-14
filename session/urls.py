from django.urls import path
from . import views

urlpatterns = [
    path('', views.session_list, name='session_list'),
    path('create/', views.create_session, name='create_session'),
    path('join/', views.join_session, name='join_session'),
    path('<uuid:session_id>/', views.whiteboard_view, name='whiteboard'),
    path('export/<uuid:session_id>/', views.export_session, name='export_session'),
]
