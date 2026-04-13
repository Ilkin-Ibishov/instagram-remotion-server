export function parseEnvInt(name: string, defaultVal: number, min: number, max: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw === '') {
        return defaultVal;
    }

    const val = Number(raw);
    if (!Number.isInteger(val)) {
        throw new Error(`Env var ${name}="${raw}" must be an integer, got: ${val}`);
    }

    if (val < min || val > max) {
        throw new Error(`Env var ${name}=${val} is out of range [${min}, ${max}]`);
    }

    return val;
}