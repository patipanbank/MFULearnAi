from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta
import json
import base64

from config.config import settings
from services.user_service import user_service
from models.user import User, UserRole
from onelogin.saml2.auth import OneLogin_Saml2_Auth
from onelogin.saml2.utils import OneLogin_Saml2_Utils
from middleware.role_guard import get_current_user_with_roles

router = APIRouter()

async def prepare_saml_request(request: Request):
    return {
        'https': 'on' if request.url.scheme == 'https' else 'off',
        'http_host': request.url.netloc,
        'script_name': request.url.path,
        'server_port': str(request.url.port or (443 if request.url.scheme == 'https' else 80)),
        'get_data': request.query_params,
        'post_data': await request.form()
    }

def init_saml_auth(req):
    auth = OneLogin_Saml2_Auth(req, old_settings=get_saml_settings())
    return auth

def get_saml_settings():
    # In production, you might want to load this from a file or a more secure location
    cert = ""
    if settings.SAML_CERTIFICATE:
        # The python3-saml library expects the certificate to be a single-line string,
        # without headers or newlines.
        cert = settings.SAML_CERTIFICATE
        cert = cert.replace("-----BEGIN CERTIFICATE-----", "")
        cert = cert.replace("-----END CERTIFICATE-----", "")
        cert = cert.replace("\\n", "").replace("\n", "")
        cert = cert.strip()

    return {
        "strict": False, # In production, set to True
        "debug": True, # In production, set to False
        "sp": {
            "entityId": settings.SAML_SP_ENTITY_ID,
            "assertionConsumerService": {
                "url": settings.SAML_SP_ACS_URL,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            },
            "singleLogoutService": {
                "url": settings.SAML_IDP_SLO_URL,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
            },
            "x509cert": "", # SP public key, optional for some IdPs
            "privateKey": "" # SP private key, optional for some IdPs
        },
        "idp": {
            "entityId": settings.SAML_IDP_ENTITY_ID or settings.SAML_IDP_SSO_URL,
            "singleSignOnService": {
                "url": settings.SAML_IDP_SSO_URL,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
            },
            "singleLogoutService": {
                "url": settings.SAML_IDP_SLO_URL,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
            },
            "x509cert": cert
        }
    }

@router.get('/login/saml')
async def saml_login(request: Request):
    req = await prepare_saml_request(request)
    auth = init_saml_auth(req)
    return RedirectResponse(auth.login())

@router.post('/saml/callback')
@router.get('/saml/callback')
async def saml_callback(request: Request):
    print(f"SAML Callback received: {request.method} {request.url}")
    print(f"Headers: {dict(request.headers)}")
    
    req = await prepare_saml_request(request)
    print(f"SAML Request prepared: {req}")
    
    auth = init_saml_auth(req)
    auth.process_response()
    errors = auth.get_errors()
    
    print(f"SAML Processing completed. Errors: {errors}")
    print(f"Authenticated: {auth.is_authenticated()}")
    
    if errors:
        print("SAML Errors:", errors)
        print("Last error reason:", auth.get_last_error_reason())
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=auth_failed&reason={auth.get_last_error_reason()}", status_code=303)

    if not auth.is_authenticated():
        print("User not authenticated")
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=not_authenticated", status_code=303)
    
    saml_attributes = auth.get_attributes()
    # Mapping from original TS code
    profile = {
        'nameID': auth.get_nameid(),
        'username': saml_attributes.get('User.Userrname', [None])[0],
        'email': saml_attributes.get('User.Email', [None])[0],
        'firstName': saml_attributes.get('first_name', [None])[0],
        'lastName': saml_attributes.get('last_name', [None])[0],
        'department': saml_attributes.get('depart_name', [None])[0],
        'groups': saml_attributes.get('http://schemas.xmlsoap.org/claims/Group', [])
    }

    user = await user_service.find_or_create_saml_user(profile)

    token_payload = {
        "sub": user.id, # 'sub' is a standard JWT claim for subject
        "nameID": user.nameID,
        "username": user.username,
        "email": user.email,
        "firstName": user.firstName,
        "lastName": user.lastName,
        "department": user.department,
        "groups": user.groups,
        "role": user.role.value,
        "exp": datetime.utcnow() + timedelta(days=7)
    }

    if not settings.JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
    token = jwt.encode(token_payload, settings.JWT_SECRET, algorithm="HS256")
    
    redirect_url = f"{settings.FRONTEND_URL}/auth/callback?token={token}"
    return RedirectResponse(redirect_url, status_code=303)

@router.get('/logout')
def logout(request: Request):
    # This would be for a session-based system. For JWT, the client just deletes the token.
    # We can provide a URL to redirect to the frontend logout page.
    return RedirectResponse(f"{settings.FRONTEND_URL}/login")

@router.get('/logout/saml')
async def saml_logout(request: Request):
    req = await prepare_saml_request(request)
    auth = init_saml_auth(req)
    
    # The name_id and session_index are required to build the LogoutRequest.
    # These would typically be stored in the user's session after login.
    # Since we are using JWT, we don't have a server-side session.
    # The frontend would need to provide these if required by the IdP.
    # For now, we will just redirect to the IdP's SLO endpoint.
    return RedirectResponse(auth.logout())

@router.get("/metadata")
async def metadata():
    saml_settings = get_saml_settings()
    sp_settings = saml_settings['sp']
    idp_settings = saml_settings['idp']
    
    # Using the library to generate metadata
    # This requires a valid settings object passed to OneLogin_Saml2_Auth
    auth = OneLogin_Saml2_Auth(None, old_settings=saml_settings)
    sp_metadata = auth.get_settings().get_sp_metadata()
    
    return Response(content=sp_metadata, media_type="application/xml")


class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminLoginResponse(BaseModel):
    token: str
    user: User

@router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(login_data: AdminLoginRequest):
    user = await user_service.find_admin_by_username(login_data.username)
    if not user or not user.password:
        raise HTTPException(status_code=401, detail="User account not found or password not set")
    
    is_match = await user_service.verify_admin_password(login_data.password, user.password)
    if not is_match:
        raise HTTPException(status_code=401, detail="Password is incorrect")

    token_payload = {
        "sub": user.id,
        "nameID": user.nameID,
        "username": user.username,
        "email": user.email,
        "firstName": user.firstName,
        "lastName": user.lastName,
        "department": user.department,
        "groups": user.groups,
        "role": user.role.value,
        "exp": datetime.utcnow() + timedelta(days=1)
    }
    
    if not settings.JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
    token = jwt.encode(token_payload, settings.JWT_SECRET, algorithm="HS256")
    
    return {"token": token, "user": user}

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user_with_roles([UserRole.STUDENTS, UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Get current authenticated user information"""
    return current_user 