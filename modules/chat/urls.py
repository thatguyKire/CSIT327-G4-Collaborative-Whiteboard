from django.urls import path
from . import views

urlpatterns = [
    path("session/<uuid:session_id>/", views.get_or_create_session_chat, name="session_chat_room"),
    path("<int:room_id>/messages/", views.fetch_messages, name="chat_messages"),
    path("<int:room_id>/send/", views.send_message, name="send_message"),
]
