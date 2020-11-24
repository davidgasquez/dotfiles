FROM archlinux:latest

RUN pacman -Sy python openssh curl bash make --noconfirm

WORKDIR /home/david
