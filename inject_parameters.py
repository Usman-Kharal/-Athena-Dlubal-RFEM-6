from pathlib import Path



def inject_parameters(content, parameters):
    for parameter, value in parameters.items():
        content = content.replace(f"<{parameter}>", str(value))
    return content


if __name__ == "__main__":
    with open(Path("local_database") / "001.js", "r") as f:
        content = f.read()

    with open(Path("local_database") / "001_injected.js", "w") as f:
        f.write(inject_parameters(content, {"total_length": 12}))
