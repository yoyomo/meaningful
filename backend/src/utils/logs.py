RED = "\033[31m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
GRAY = "\033[90m"
GREEN = "\033[32m"
RESET = "\033[0m"

def log_error(message: str):
    print(f"{RED}{message}:{RESET}")

def log_warning(message: str):
    print(f"{YELLOW}{message}:{RESET}")

def log_info(message: str):
    print(f"{BLUE}{message}:{RESET}")

def log_debug(message: str):
    print(f"{GRAY}{message}:{RESET}")

def log_success(message: str):
    print(f"{GREEN}{message}:{RESET}")