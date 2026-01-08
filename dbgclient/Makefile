CC = gcc
CFLAGS = -Wall -g -I.
LIBS = -lcurl

all: client

client: client.o cJSON.o
	$(CC) $(CFLAGS) -o client client.o cJSON.o $(LIBS)

client.o: client.c
	$(CC) $(CFLAGS) -c client.c

cJSON.o: cJSON.c cJSON.h
	$(CC) $(CFLAGS) -c cJSON.c

clean:
	rm -f client client.o cJSON.o payload_temp.py stdout.txt stderr.txt
