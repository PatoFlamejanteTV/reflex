#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <unistd.h>
#include <sys/wait.h>
#include "curl/curl.h"
#include "cJSON.h"

#define SERVER_URL "http://localhost:3000"
#define MASTER_PROMPT "CPU Spike/Stress tester, short test that only lasts for 5 seconds"
#define MAX_RETRIES 4

// Global argv[0] for self-destruct
char *EXEC_NAME = NULL;

void log_msg(const char *format, ...) {
    va_list args;
    printf("[Client] ");
    va_start(args, format);
    vprintf(format, args);
    va_end(args);
    printf("\n");
    fflush(stdout);
}

void self_destruct() {
    log_msg("Received 418. Self-destructing...");
    if (EXEC_NAME) {
        if (unlink(EXEC_NAME) == 0) {
            log_msg("Successfully deleted self.");
        } else {
            log_msg("Failed to delete self.");
        }
    }
    exit(0);
}

struct MemoryStruct {
    char *memory;
    size_t size;
};

static size_t WriteMemoryCallback(void *contents, size_t size, size_t nmemb, void *userp) {
    size_t realsize = size * nmemb;
    struct MemoryStruct *mem = (struct MemoryStruct *)userp;

    char *ptr = realloc(mem->memory, mem->size + realsize + 1);
    if(!ptr) {
        log_msg("Not enough memory (realloc returned NULL)");
        return 0;
    }

    mem->memory = ptr;
    memcpy(&(mem->memory[mem->size]), contents, realsize);
    mem->size += realsize;
    mem->memory[mem->size] = 0;

    return realsize;
}

// Returns response body. Caller must free.
char* http_request(const char *endpoint, const char *json_payload) {
    CURL *curl;
    CURLcode res;
    struct MemoryStruct chunk;

    chunk.memory = malloc(1);
    chunk.memory[0] = '\0';
    chunk.size = 0;

    log_msg("Starting HTTP request to %s", endpoint);
    if (json_payload) {
        log_msg("Payload: %s", json_payload);
    } else {
        log_msg("Method: GET");
    }

    curl = curl_easy_init();
    if(curl) {
        char url[1024];
        snprintf(url, sizeof(url), "%s%s", SERVER_URL, endpoint);

        curl_easy_setopt(curl, CURLOPT_URL, url);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteMemoryCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
        curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 10L);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);

        struct curl_slist *headers = NULL;
        if (json_payload) {
            headers = curl_slist_append(headers, "Content-Type: application/json");
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_payload);
        }

        res = curl_easy_perform(curl);

        long response_code;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);

        log_msg("Response Code: %ld", response_code);

        if (strcmp(endpoint, "/ping") == 0 && response_code == 418) {
            curl_easy_cleanup(curl);
            if (headers) curl_slist_free_all(headers);
            free(chunk.memory);
            self_destruct();
        }

        if(res != CURLE_OK) {
            log_msg("curl_easy_perform() failed: %s", curl_easy_strerror(res));
            free(chunk.memory);
            curl_easy_cleanup(curl);
            if (headers) curl_slist_free_all(headers);
            return NULL;
        }

        if (chunk.memory) {
            log_msg("Response Body: %s", chunk.memory);
        }

        curl_easy_cleanup(curl);
        if (headers) curl_slist_free_all(headers);
    } else {
        log_msg("Failed to init curl");
        free(chunk.memory);
        return NULL;
    }

    return chunk.memory;
}

char *read_file(const char *filename) {
    FILE *f = fopen(filename, "r");
    if (!f) return strdup("");
    fseek(f, 0, SEEK_END);
    long length = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *buffer = malloc(length + 1);
    if (buffer) {
        fread(buffer, 1, length, f);
        buffer[length] = '\0';
    }
    fclose(f);
    return buffer;
}

int run_payload(const char *code, char **stdout_out, char **stderr_out) {
    log_msg("Executing payload...");
    log_msg("Code content:\n%s", code);

    FILE *f = fopen("payload_temp.py", "w");
    if (!f) {
        log_msg("Failed to write payload_temp.py");
        return -1;
    }
    fprintf(f, "%s", code);
    fclose(f);

    pid_t pid = fork();
    if (pid == -1) {
        log_msg("Failed to fork");
        return -1;
    } else if (pid == 0) {
        // Child process
        int stdout_fd = open("stdout.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
        int stderr_fd = open("stderr.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
        if (stdout_fd < 0 || stderr_fd < 0) {
            exit(127);
        }
        dup2(stdout_fd, STDOUT_FILENO);
        dup2(stderr_fd, STDERR_FILENO);
        close(stdout_fd);
        close(stderr_fd);

        char *const argv[] = {"python3", "payload_temp.py", NULL};
        execvp("python3", argv);
        // execvp only returns on error
        exit(127);
    }

    // Parent process
    int status;
    waitpid(pid, &status, 0);

    int exit_code = -1;
    if (WIFEXITED(status)) {
        exit_code = WEXITSTATUS(status);
    }

    *stdout_out = read_file("stdout.txt");
    *stderr_out = read_file("stderr.txt");

    log_msg("Execution finished with code %d", exit_code);
    log_msg("STDOUT:\n%s", *stdout_out);
    log_msg("STDERR:\n%s", *stderr_out);

    unlink("payload_temp.py");
    unlink("stdout.txt");
    unlink("stderr.txt");

    return exit_code;
}

int main(int argc, char *argv[]) {
    EXEC_NAME = argv[0];

    log_msg("RefleX Client C Started. Target: %s", SERVER_URL);
    log_msg("Master Prompt: %s", MASTER_PROMPT);

    curl_global_init(CURL_GLOBAL_ALL);

    // 1. Ping
    char *ping_resp = http_request("/ping", NULL);
    if (ping_resp) {
        log_msg("Server Ping: OK");
        free(ping_resp);
    } else {
        log_msg("Could not reach server. Exiting.");
        curl_global_cleanup();
        return 1;
    }

    // 2. Initial Generation
    char *current_code = NULL;
    cJSON *req_json = cJSON_CreateObject();
    cJSON_AddStringToObject(req_json, "master_prompt", MASTER_PROMPT);
    char *json_str = cJSON_PrintUnformatted(req_json);

    char *gen_resp = http_request("/gen", json_str);
    cJSON_Delete(req_json);
    free(json_str);

    if (gen_resp) {
        cJSON *resp_json = cJSON_Parse(gen_resp);
        if (resp_json) {
            cJSON *code_item = cJSON_GetObjectItemCaseSensitive(resp_json, "code");
            if (cJSON_IsString(code_item) && (code_item->valuestring != NULL)) {
                current_code = strdup(code_item->valuestring);
            }
            cJSON_Delete(resp_json);
        }
        free(gen_resp);
    }

    if (!current_code || strlen(current_code) == 0) {
        log_msg("No code received or failed to parse.");
        curl_global_cleanup();
        if(current_code) free(current_code);
        return 1;
    }

    // 3. Execution Loop
    for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        log_msg("--- Attempt %d ---", attempt + 1);

        char *stdout_output = NULL;
        char *stderr_output = NULL;
        int exit_code = run_payload(current_code, &stdout_output, &stderr_output);

        if (exit_code == 0) {
            log_msg("Payload executed successfully!");
            if(stdout_output) free(stdout_output);
            if(stderr_output) free(stderr_output);
            break;
        } else {
            log_msg("Payload failed with exit code %d", exit_code);

            if (attempt < MAX_RETRIES) {
                log_msg("Requesting fix from server...");

                int err_len = snprintf(NULL, 0, "Exit Code: %d\nStderr: %s\nStdout: %s", exit_code, stderr_output ? stderr_output : "", stdout_output ? stdout_output : "");
                char *error_log = malloc(err_len + 1);
                if (!error_log) {
                    log_msg("Failed to allocate memory for error log.");
                    // Handle memory allocation failure, e.g., by breaking the loop
                    if(stdout_output) free(stdout_output);
                    if(stderr_output) free(stderr_output);
                    break;
                }
                snprintf(error_log, err_len + 1, "Exit Code: %d\nStderr: %s\nStdout: %s", exit_code, stderr_output ? stderr_output : "", stdout_output ? stdout_output : "");

                cJSON *fix_req = cJSON_CreateObject();
                cJSON_AddStringToObject(fix_req, "code", current_code);
                cJSON_AddStringToObject(fix_req, "error", error_log);
                cJSON_AddStringToObject(fix_req, "master_prompt", MASTER_PROMPT);

                char *fix_json_str = cJSON_PrintUnformatted(fix_req);
                char *fix_resp = http_request("/fix", fix_json_str);

                cJSON_Delete(fix_req);
                free(fix_json_str);
                free(error_log);

                if (fix_resp) {
                    cJSON *fix_json = cJSON_Parse(fix_resp);
                    if (fix_json) {
                        cJSON *status_item = cJSON_GetObjectItemCaseSensitive(fix_json, "status");
                        if (cJSON_IsString(status_item) && strcmp(status_item->valuestring, "ok") == 0) {
                            log_msg("Server signaled NO_ERROR. Stopping.");
                            cJSON_Delete(fix_json);
                            free(fix_resp);
                            if(stdout_output) free(stdout_output);
                            if(stderr_output) free(stderr_output);
                            break;
                        }

                        cJSON *new_code_item = cJSON_GetObjectItemCaseSensitive(fix_json, "code");
                        if (cJSON_IsString(new_code_item) && (new_code_item->valuestring != NULL)) {
                            free(current_code);
                            current_code = strdup(new_code_item->valuestring);
                        } else {
                            log_msg("Server returned no fix.");
                            cJSON_Delete(fix_json);
                            free(fix_resp);
                            if(stdout_output) free(stdout_output);
                            if(stderr_output) free(stderr_output);
                            break;
                        }
                        cJSON_Delete(fix_json);
                    }
                    free(fix_resp);
                } else {
                     log_msg("Failed to get fix response");
                     if(stdout_output) free(stdout_output);
                     if(stderr_output) free(stderr_output);
                     break;
                }
            } else {
                log_msg("Max retries reached. Giving up.");
            }
        }

        if(stdout_output) free(stdout_output);
        if(stderr_output) free(stderr_output);
    }

    if (current_code) free(current_code);
    curl_global_cleanup();
    return 0;
}
